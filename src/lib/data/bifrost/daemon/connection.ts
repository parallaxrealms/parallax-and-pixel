// Mimir Daemon WebSocket Connection Manager
// Handles auth, reconnection with backoff, state recovery, and message routing.

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

/** Messages the client sends to the daemon */
export type WsClientMessage =
	| { type: 'auth'; token: string }
	| { type: 'refresh_token'; token: string }
	| { type: 'reconnect'; conversationId: string; lastMessageId?: string }
	| { type: 'chat'; conversationId?: string; message: string; model?: string; agent?: string }
	| { type: 'cancel' };

/** Soft budget warning the daemon may attach to a `done` message. Informational
 * only — the daemon does not hard-block on it. */
export interface BudgetWarning {
	scope: 'daily';
	usedTokens: number;
	limitTokens: number;
	fraction: number; // used / limit (can exceed 1)
	warningThreshold: number; // the 0..1 fraction that triggered it
	message: string;
}

/** Messages the daemon sends to the client */
export type WsServerMessage =
	| { type: 'chunk'; content: string; messageId: string }
	| {
			type: 'done';
			messageId: string;
			conversationId: string;
			/** Persisted id of the user message that opened this turn — lets the store swap
			 *  its optimistic client id for the real one (needed for regenerate/edit). */
			userMessageId?: string;
			/** The model that actually answered (after the tier ladder / fallback resolved). */
			model?: string;
			usage: { inputTokens: number; outputTokens: number; contextTokens?: number; contextLimit?: number };
			/** Optional soft budget warning attached by the daemon when daily usage crosses the threshold. */
			budgetWarning?: BudgetWarning;
			/** Present + performed when the daemon auto-compacted this conversation on this turn. */
			compaction?: { performed: boolean };
	  }
	| { type: 'error'; errorCode: string; message: string; messageId?: string; partial: boolean }
	| { type: 'tool_call'; toolCallId?: string; name: string; params: Record<string, unknown>; messageId: string }
	| {
			type: 'tool_result';
			toolCallId?: string;
			name: string;
			result: unknown;
			truncated: boolean;
			messageId: string;
	  }
	| { type: 'conversation_update'; id: string; title: string }
	| { type: 'interrupted'; messageId: string; partialContent: string }
	| { type: 'reconnected'; conversationId: string }
	| { type: 'proactive'; content: string; conversationId?: string };

type MessageHandler = (message: WsServerMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

/** Auth/policy-related error reason surfaced when status becomes `'error'` for a
 *  reason the UI should treat as non-recoverable-via-retry (e.g. show a re-login
 *  prompt rather than spinning a reconnect loop). `null` for ordinary network errors. */
export type AuthErrorCode = 'auth_failed' | 'forbidden_origin' | 'session_expired';

/** Narrow `unknown` to a `WsServerMessage`. Runtime-validates the discriminant and
 *  the per-type required fields we actually dispatch on. Returns null on anything
 *  malformed/unknown so the caller can warn + drop instead of appending garbage. */
function parseServerMessage(raw: unknown): WsServerMessage | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const m = raw as Record<string, unknown>;
	if (typeof m.type !== 'string') return null;

	switch (m.type) {
		case 'chunk':
			// Guard content is a string — a missing/non-string content used to append the
			// literal "undefined" into the stream.
			if (typeof m.content !== 'string' || typeof m.messageId !== 'string') return null;
			return m as unknown as WsServerMessage;
		case 'done':
			if (typeof m.messageId !== 'string' || typeof m.conversationId !== 'string') return null;
			return m as unknown as WsServerMessage;
		case 'error':
			if (typeof m.errorCode !== 'string' || typeof m.message !== 'string') return null;
			return m as unknown as WsServerMessage;
		case 'interrupted':
			if (typeof m.messageId !== 'string' || typeof m.partialContent !== 'string') return null;
			return m as unknown as WsServerMessage;
		case 'reconnected':
			if (typeof m.conversationId !== 'string') return null;
			return m as unknown as WsServerMessage;
		case 'conversation_update':
			if (typeof m.id !== 'string') return null;
			return m as unknown as WsServerMessage;
		case 'tool_call':
		case 'tool_result':
		case 'proactive':
			return m as unknown as WsServerMessage;
		default:
			return null;
	}
}

// ── Constants ────────────────────────────────────

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_JITTER_MS = 500;
const MAX_CONSECUTIVE_FAILURES = 10;
const JWT_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

// ── Connection Manager ───────────────────────────

export class DaemonConnection {
	private ws: WebSocket | null = null;
	private daemonUrl: string;
	private supabase: SupabaseClient;
	private status: ConnectionStatus = 'disconnected';
	private authError: AuthErrorCode | null = null;
	private messageHandlers: MessageHandler[] = [];
	private statusHandlers: StatusHandler[] = [];

	// Reconnection state
	private consecutiveFailures = 0;
	private backoffMs = INITIAL_BACKOFF_MS;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private intentionalClose = false;

	// State recovery
	private activeConversationId: string | null = null;
	private lastMessageId: string | null = null;

	// JWT refresh
	private jwtRefreshTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(daemonUrl: string, supabase: SupabaseClient) {
		this.daemonUrl = daemonUrl;
		this.supabase = supabase;
	}

	// ── Public API ─────────────────────────────────

	async connect(): Promise<void> {
		if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
			return;
		}

		this.intentionalClose = false;
		this.authError = null;
		this.setStatus('connecting');

		const token = await this.getJwt();
		if (!token) {
			// No session at all — surface as an auth error so the UI can prompt re-login
			// instead of showing a bare 'error' with no actionable reason.
			this.setAuthError('session_expired');
			return;
		}

		this.openWebSocket(token);
	}

	disconnect(): void {
		this.intentionalClose = true;
		this.clearReconnectTimer();
		this.clearJwtRefreshTimer();
		if (this.ws) {
			this.ws.close(1000, 'Client disconnecting');
			this.ws = null;
		}
		this.setStatus('disconnected');
	}

	send(message: WsClientMessage): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}

	sendChat(message: string, conversationId?: string, model?: string, agent?: string): void {
		this.send({ type: 'chat', conversationId, message, model, agent });
	}

	cancelStream(): void {
		this.send({ type: 'cancel' });
	}

	setActiveConversation(id: string | null, lastMessageId?: string): void {
		this.activeConversationId = id;
		this.lastMessageId = lastMessageId ?? null;
	}

	onMessage(handler: MessageHandler): () => void {
		this.messageHandlers.push(handler);
		return () => {
			this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
		};
	}

	onStatusChange(handler: StatusHandler): () => void {
		this.statusHandlers.push(handler);
		return () => {
			this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
		};
	}

	getStatus(): ConnectionStatus {
		return this.status;
	}

	/** Set after the connection lands in `'error'` for an auth/policy reason
	 *  (bad/expired token, forbidden origin). `null` when the last error was an
	 *  ordinary network failure (which is retried via backoff). The UI can use this
	 *  to prompt re-login instead of showing a spinning reconnect. */
	getAuthError(): AuthErrorCode | null {
		return this.authError;
	}

	// ── Private: WebSocket lifecycle ───────────────

	private openWebSocket(token: string): void {
		try {
			// Defensive scheme conversion: the browser WebSocket() constructor rejects
			// http(s) URLs. Callers should already pass ws(s), but converting here keeps
			// DaemonConnection safe regardless of caller. Idempotent on ws(s) URLs.
			this.ws = new WebSocket(this.daemonUrl.replace(/^http/, 'ws'));
		} catch {
			this.handleConnectionFailure();
			return;
		}

		this.ws.onopen = () => {
			// Authenticate immediately
			this.send({ type: 'auth', token });
		};

		this.ws.onmessage = (event) => {
			let raw: unknown;
			try {
				raw = JSON.parse(event.data);
			} catch {
				console.warn('[DaemonConnection] dropping unparseable WS frame');
				return;
			}
			const message = parseServerMessage(raw);
			if (!message) {
				console.warn(
					'[DaemonConnection] dropping invalid/unknown WS frame',
					(raw as { type?: unknown })?.type
				);
				return;
			}
			this.handleMessage(message);
		};

		this.ws.onclose = (event) => {
			this.ws = null;
			if (this.intentionalClose) return;

			// Auth/policy closes: the same dead token will keep failing, so do NOT enter
			// the blind backoff loop re-sending it. Surface an auth error the UI can act on.
			if (event.code === 4001) {
				// 4001 = auth timeout / invalid token
				this.setAuthError('auth_failed');
				return;
			}
			if (event.code === 4003) {
				// 4003 = forbidden origin
				this.setAuthError('forbidden_origin');
				return;
			}

			// Network / other closes (incl. 1001 server shutting down): keep backing off.
			this.handleConnectionFailure();
		};

		this.ws.onerror = () => {
			// onclose will fire after this — handle reconnection there
		};
	}

	private handleMessage(message: WsServerMessage): void {
		// Handle auth/reconnect confirmations
		if (message.type === 'reconnected') {
			this.authError = null;
			this.setStatus('connected');
			this.consecutiveFailures = 0;
			this.backoffMs = INITIAL_BACKOFF_MS;
			this.scheduleJwtRefresh();
			// Dispatch to handlers so UI can react
		}

		if (message.type === 'interrupted') {
			this.setStatus('connected');
			// Dispatch to handlers — UI shows partial content with retry option
		}

		// Track message IDs for state recovery
		if (message.type === 'done' && message.conversationId) {
			this.lastMessageId = message.messageId;
		}

		// Dispatch to all registered handlers
		for (const handler of this.messageHandlers) {
			handler(message);
		}
	}

	private handleConnectionFailure(): void {
		this.consecutiveFailures++;

		if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
			this.setStatus('error');
			return;
		}

		this.setStatus('reconnecting');

		// Exponential backoff with jitter
		const jitter = (Math.random() * 2 - 1) * BACKOFF_JITTER_MS;
		const delay = Math.min(this.backoffMs + jitter, MAX_BACKOFF_MS);
		this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);

		this.reconnectTimer = setTimeout(async () => {
			const token = await this.getJwt();
			if (!token) {
				this.handleConnectionFailure();
				return;
			}
			this.openWebSocket(token);

			// After auth succeeds, send reconnect if we had an active conversation
			// (handled in the 'reconnected' message handler — daemon sends state)
			if (this.activeConversationId) {
				// Wait briefly for auth to complete before sending reconnect
				setTimeout(() => {
					this.send({
						type: 'reconnect',
						conversationId: this.activeConversationId!,
						lastMessageId: this.lastMessageId ?? undefined
					});
				}, 500);
			}
		}, delay);
	}

	// ── Private: JWT management ────────────────────

	private async getJwt(): Promise<string | null> {
		const { data } = await this.supabase.auth.getSession();
		return data.session?.access_token ?? null;
	}

	private scheduleJwtRefresh(): void {
		this.clearJwtRefreshTimer();

		// Get session expiry and refresh proactively
		this.supabase.auth.getSession().then(({ data }) => {
			if (!data.session) return;

			const expiresAt = (data.session.expires_at ?? 0) * 1000; // convert to ms
			const refreshIn = expiresAt - Date.now() - JWT_REFRESH_BUFFER_MS;

			if (refreshIn <= 0) {
				// Token about to expire or already expired — refresh now
				this.refreshJwt();
				return;
			}

			this.jwtRefreshTimer = setTimeout(() => this.refreshJwt(), refreshIn);
		});
	}

	private async refreshJwt(): Promise<void> {
		const { data, error } = await this.supabase.auth.refreshSession();
		if (error || !data.session) {
			// Refresh failed (expired/revoked refresh token). Don't swallow it — the
			// daemon will soon reject the stale token anyway, so surface a re-login
			// prompt now instead of letting the session silently rot.
			console.warn('[DaemonConnection] JWT refresh failed:', error?.message);
			this.setAuthError('session_expired');
			return;
		}

		// Send new token to daemon over existing connection
		this.send({ type: 'refresh_token', token: data.session.access_token });
		this.scheduleJwtRefresh();
	}

	// ── Private: Helpers ───────────────────────────

	private setStatus(status: ConnectionStatus): void {
		if (this.status === status) return;
		this.status = status;
		for (const handler of this.statusHandlers) {
			handler(status);
		}
	}

	/** Move to a non-retryable `'error'` state for an auth/policy reason. Clears any
	 *  pending reconnect/refresh timers so we don't keep hammering the daemon with a
	 *  token it has already rejected. */
	private setAuthError(code: AuthErrorCode): void {
		this.authError = code;
		this.clearReconnectTimer();
		this.clearJwtRefreshTimer();
		// Force the status event even if we were already `'error'` so subscribers can
		// re-read getAuthError() (setStatus dedupes on equal status).
		this.status = 'error';
		for (const handler of this.statusHandlers) {
			handler('error');
		}
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private clearJwtRefreshTimer(): void {
		if (this.jwtRefreshTimer) {
			clearTimeout(this.jwtRefreshTimer);
			this.jwtRefreshTimer = null;
		}
	}
}

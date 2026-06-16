// Bifrost Reactive Store (Svelte 5 runes) — single-tenant chat client.
//
// Connects DIRECTLY to the Bifrost daemon: a WebSocket for streaming + a REST
// client for CRUD, authed with the user's Supabase JWT. Conversation/message
// state lives DAEMON-SIDE — this app stores nothing in Supabase.
//
// Ported from 9realms with mock-mode stripped: when PUBLIC_BIFROST_DAEMON_URL is
// unset (or 'mock') the store enters a `notConfigured` state and the tab renders
// a graceful banner instead of attempting a connection.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
	DaemonConnection,
	DaemonRestClient,
	type ConnectionStatus,
	type WsServerMessage,
	type DaemonConversation,
	type DaemonMessage,
	type BudgetWarning,
	type SelectableModel,
	type CompactionResult
} from '$lib/data/bifrost/daemon';
import { DEFAULT_AGENT, resolveAgentKey, type AgentKey } from '$lib/config/bifrostAgents';

// ── Singleton state ──────────────────────────────

let connection: DaemonConnection | null = null;
let rest: DaemonRestClient | null = null;
let cleanupFns: Array<() => void> = [];
let supabaseRef: SupabaseClient | null = null;

// ── Budget config (stubbed) ──────────────────────
// No Supabase tables in this single-tenant port. The header budget bar uses a
// hardcoded default daily cap; per-turn usage from the daemon's `done` frame is
// still summed live so the bar moves during a session. Usage-reporting back to a
// backend is a no-op here (the daemon already meters server-side).
const DEFAULT_DAILY_LIMIT = 100_000;

// ── Reactive state ───────────────────────────────

let connectionStatus = $state<ConnectionStatus>('disconnected');
// True when no daemon URL is configured — drives the "not configured" banner.
let notConfigured = $state(false);
let conversations = $state<DaemonConversation[]>([]);
let activeConversationId = $state<string | null>(null);
let messageCache = $state<Map<string, DaemonMessage[]>>(new Map());
// The agent persona for NEW chats and the header when no conversation is bound.
let selectedAgent = $state<AgentKey>(DEFAULT_AGENT);

/** Set messages in cache and trigger Svelte reactivity */
function setCacheMessages(convId: string, msgs: DaemonMessage[]): void {
	messageCache.set(convId, msgs);
	messageCache = new Map(messageCache);
}

/** Commit a partial assistant message (from cancel / interrupt / socket drop) into a
 *  conversation's cache instead of throwing the streamed text away. Marks it
 *  `status: 'error'` so the UI can flag it as incomplete. Idempotent on messageId. */
function commitPartialMessage(convId: string, messageId: string | null, content: string): void {
	const messages = messageCache.get(convId) ?? [];
	const id = messageId ?? crypto.randomUUID();
	const partialMsg: DaemonMessage = {
		id,
		conversation_id: convId,
		role: 'assistant',
		content,
		status: 'error', // incomplete/partial
		model,
		tokens_used: null,
		emotional_state: null,
		tool_calls: null,
		tool_results: null,
		source: 'odin',
		created_at: new Date().toISOString()
	};
	const idx = messages.findIndex((m) => m.id === id);
	if (idx >= 0) {
		const next = [...messages];
		next[idx] = { ...next[idx], content, status: 'error' };
		setCacheMessages(convId, next);
	} else if (content.length > 0) {
		setCacheMessages(convId, [...messages, partialMsg]);
	}
}
let streaming = $state(false);
let streamingMessageId = $state<string | null>(null);
let streamingContent = $state('');
// Tools the agent ran during the in-flight turn (from tool_call/tool_result frames).
interface StreamToolCall {
	toolCallId?: string;
	name: string;
	params: Record<string, unknown>;
	status: 'running' | 'done';
	startedAt: number;
	endedAt?: number;
}
let streamingToolCalls = $state<StreamToolCall[]>([]);
// The conversation the in-flight stream belongs to.
let streamingConversationId = $state<string | null>(null);
let lastError = $state<{ code: string; message: string; partial: boolean } | null>(null);
// 'auto' = let the daemon's tier ladder pick. A concrete id forces that model.
let model = $state('auto');
// Picker catalog. Falls back to this minimal list until the daemon's GET /api/models
// is reachable (which adds the full set + per-user availability).
const FALLBACK_MODELS: SelectableModel[] = [
	{ id: 'auto', label: 'Auto', tier: 'auto', free: true, available: true },
	{ id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', tier: 'haiku', provider: 'anthropic', available: true },
	{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', tier: 'sonnet', provider: 'anthropic', available: true },
	{ id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B', tier: 'free', provider: 'openrouter', free: true, available: true }
];
let availableModels = $state<SelectableModel[]>(FALLBACK_MODELS);
// Context-window usage from the daemon's most recent `done`.
let contextTokens = $state<number | null>(null);
let contextLimit = $state<number | null>(null);
// Soft daily-budget warning from the daemon's most recent `done`.
let budgetWarning = $state<BudgetWarning | null>(null);
// Per-user DAILY token budget (the cap). Stubbed: baseline 0, hardcoded cap;
// incremented per exchange so the header bar stays live within a session.
let dailyTokens = $state(0);
let dailyLimit = $state<number | null>(DEFAULT_DAILY_LIMIT);
// One-time marker that the daemon auto-compacted earlier turns this turn.
let compactionNotice = $state(false);

// ── Derived state ────────────────────────────────

const activeConversation = $derived(conversations.find((c) => c.id === activeConversationId) ?? null);
const activeAgent = $derived<AgentKey>(resolveAgentKey(activeConversation?.agent ?? selectedAgent));
const activeMessages = $derived(activeConversationId ? messageCache.get(activeConversationId) ?? [] : []);
const activeStreaming = $derived(streaming && streamingConversationId === activeConversationId);
const activeStreamingContent = $derived(
	streaming && streamingConversationId === activeConversationId ? streamingContent : ''
);
const activeStreamingToolCalls = $derived(
	streaming && streamingConversationId === activeConversationId ? streamingToolCalls : []
);

// ── Init / Teardown ──────────────────────────────

export function initBifrost(supabase: SupabaseClient, daemonUrl: string): void {
	// Cleanup previous connection if any
	teardownBifrost();

	supabaseRef = supabase;
	loadDailyBudget();

	// No daemon URL (or the legacy 'mock' sentinel) → not configured. Render the
	// graceful banner instead of mock chat or a spinning error.
	if (!daemonUrl || daemonUrl === 'mock') {
		notConfigured = true;
		connectionStatus = 'disconnected';
		return;
	}

	notConfigured = false;

	// WebSocket URL: convert http(s) → ws(s) and ensure it ends with /ws.
	const base = daemonUrl.replace(/\/$/, '');
	const wsUrl = base.replace(/^http/, 'ws') + (base.includes('/ws') ? '' : '/ws');

	connection = new DaemonConnection(wsUrl, supabase);
	rest = new DaemonRestClient(daemonUrl, supabase);

	// Wire status updates
	const unsubStatus = connection.onStatusChange((status) => {
		connectionStatus = status;
		// Reconcile an orphaned in-flight stream: if the socket drops while streaming,
		// the `done` frame will never arrive. Commit the partial, flag a recoverable
		// error, and clear the streaming flag so the UI doesn't spin forever.
		if (streaming && (status === 'reconnecting' || status === 'disconnected' || status === 'error')) {
			const convId = streamingConversationId ?? activeConversationId;
			if (convId) {
				commitPartialMessage(convId, streamingMessageId, streamingContent);
			}
			const authError = connection?.getAuthError() ?? null;
			lastError = authError
				? {
						code: authError,
						message:
							authError === 'session_expired'
								? 'Session expired — please sign in again.'
								: authError === 'forbidden_origin'
									? 'Connection refused by server.'
									: 'Authentication failed — please sign in again.',
						partial: true
					}
				: { code: 'connection_lost', message: 'Connection lost — the response was interrupted.', partial: true };
			streaming = false;
			streamingContent = '';
			streamingMessageId = null;
			streamingConversationId = null;
		}
	});

	// Wire message handling
	const unsubMessages = connection.onMessage(handleDaemonMessage);

	cleanupFns = [unsubStatus, unsubMessages];

	// Connect
	connection.connect();

	// Load conversations + the model picker catalog
	loadConversations();
	loadModels();
}

/** Pull the selectable-model catalog from the daemon; keep the fallback on failure. */
async function loadModels(): Promise<void> {
	if (!rest) return;
	try {
		const res = await rest.listModels();
		if (res?.models?.length) availableModels = res.models;
	} catch {
		// /api/models not available — keep FALLBACK_MODELS.
	}
}

/** STUBBED. The 9realms version read today's usage + cap from Supabase
 *  (bifrost_token_usage / bifrost_budget_config). This single-tenant port has no
 *  such tables, so we seed the bar with a zero baseline + hardcoded daily cap.
 *  Per-turn usage from the daemon's `done` frames is summed live thereafter. */
async function loadDailyBudget(): Promise<void> {
	dailyTokens = 0;
	dailyLimit = DEFAULT_DAILY_LIMIT;
}

export function teardownBifrost(): void {
	for (const fn of cleanupFns) fn();
	cleanupFns = [];
	connection?.disconnect();
	connection = null;
	rest = null;
	supabaseRef = null;
	notConfigured = false;
	connectionStatus = 'disconnected';
	conversations = [];
	activeConversationId = null;
	messageCache = new Map();
	streaming = false;
	streamingContent = '';
	streamingMessageId = null;
	streamingConversationId = null;
	lastError = null;
	contextTokens = null;
	contextLimit = null;
	budgetWarning = null;
	compactionNotice = false;
}

// ── Message Handler ──────────────────────────────

function handleDaemonMessage(msg: WsServerMessage): void {
	switch (msg.type) {
		case 'chunk':
			if (!streaming) break;
			if (streamingMessageId && msg.messageId !== streamingMessageId) break;
			if (!streamingMessageId) streamingMessageId = msg.messageId;
			streamingContent += msg.content;
			break;

		case 'done': {
			const targetConvId = msg.conversationId;
			const isInFlight =
				streaming &&
				streamingConversationId === targetConvId &&
				(!streamingMessageId || streamingMessageId === msg.messageId);
			const content = isInFlight ? streamingContent : '';

			const messages = messageCache.get(targetConvId) ?? [];
			// Reconcile the optimistic user message's client id with the persisted id.
			let base = messages;
			if (msg.userMessageId) {
				for (let i = messages.length - 1; i >= 0; i--) {
					if (messages[i].role === 'user') {
						if (messages[i].id !== msg.userMessageId) {
							base = [...messages];
							base[i] = { ...base[i], id: msg.userMessageId };
						}
						break;
					}
				}
			}
			// Persist the tools this turn ran onto the finished message.
			const turnTools =
				isInFlight && streamingToolCalls.length
					? streamingToolCalls.map((t) => ({
							name: t.name,
							input: t.params,
							durationMs: t.endedAt ? t.endedAt - t.startedAt : undefined
						}))
					: null;
			const finalMsg: DaemonMessage = {
				id: msg.messageId,
				conversation_id: targetConvId,
				role: 'assistant',
				content,
				status: 'complete',
				model: msg.model ?? model,
				tokens_used: (msg.usage?.inputTokens ?? 0) + (msg.usage?.outputTokens ?? 0),
				emotional_state: null,
				tool_calls: turnTools,
				tool_results: null,
				source: 'odin',
				created_at: new Date().toISOString()
			};
			setCacheMessages(targetConvId, [...base, finalMsg]);

			if (targetConvId === activeConversationId) {
				contextTokens = msg.usage?.contextTokens ?? null;
				contextLimit = msg.usage?.contextLimit ?? null;
			}
			// Keep the daily budget bar live without a backend round-trip.
			dailyTokens += (msg.usage?.inputTokens ?? 0) + (msg.usage?.outputTokens ?? 0);
			if (msg.budgetWarning) budgetWarning = msg.budgetWarning;

			const compaction = (msg as { compaction?: { performed?: boolean } }).compaction;
			if (compaction?.performed && targetConvId === activeConversationId) {
				compactionNotice = true;
			}

			if (isInFlight || streamingConversationId === targetConvId) {
				streaming = false;
				streamingContent = '';
				streamingMessageId = null;
				streamingConversationId = null;
				lastError = null;
			}
			break;
		}

		case 'error':
			lastError = { code: msg.errorCode, message: msg.message, partial: msg.partial };
			if (!msg.partial) {
				streaming = false;
				streamingContent = '';
				streamingMessageId = null;
				streamingConversationId = null;
			}
			break;

		case 'conversation_update': {
			const idx = conversations.findIndex((c) => c.id === msg.id);
			if (idx >= 0) {
				conversations[idx] = { ...conversations[idx], title: msg.title };
				conversations = [...conversations];
			}
			break;
		}

		case 'interrupted': {
			const convId = streamingConversationId ?? activeConversationId;
			if (convId) {
				commitPartialMessage(convId, msg.messageId, msg.partialContent);
			}
			streaming = false;
			streamingContent = '';
			streamingMessageId = null;
			streamingConversationId = null;
			lastError = { code: 'interrupted', message: 'Response was interrupted', partial: true };
			break;
		}

		case 'tool_call':
			streamingToolCalls = [
				...streamingToolCalls,
				{
					toolCallId: msg.toolCallId,
					name: msg.name,
					params: msg.params ?? {},
					status: 'running',
					startedAt: Date.now()
				}
			];
			break;

		case 'tool_result': {
			const i = msg.toolCallId
				? streamingToolCalls.findLastIndex((t) => t.toolCallId === msg.toolCallId)
				: streamingToolCalls.findLastIndex((t) => t.name === msg.name && t.status === 'running');
			if (i >= 0) {
				const next = [...streamingToolCalls];
				next[i] = { ...next[i], status: 'done', endedAt: Date.now() };
				streamingToolCalls = next;
			}
			break;
		}

		case 'proactive':
			// Not surfaced in this MVP.
			break;
	}
}

// ── Actions ──────────────────────────────────────

export async function loadConversations(): Promise<void> {
	if (!rest) return;
	try {
		conversations = await rest.listConversations();
	} catch (err) {
		console.error('Failed to load conversations:', err);
	}
}

export async function createConversation(): Promise<string | null> {
	if (!rest) return null;
	try {
		const conv = await rest.createConversation(undefined, selectedAgent);
		conversations = [conv, ...conversations];
		activeConversationId = conv.id;
		setCacheMessages(conv.id, []);
		connection?.setActiveConversation(conv.id);
		return conv.id;
	} catch (err) {
		console.error('Failed to create conversation:', err);
		return null;
	}
}

export async function selectConversation(id: string): Promise<void> {
	if (id === activeConversationId) return;
	activeConversationId = id;
	const target = conversations.find((c) => c.id === id);
	if (target?.agent) selectedAgent = resolveAgentKey(target.agent);
	lastError = null;
	contextTokens = null;
	contextLimit = null;
	budgetWarning = null;
	compactionNotice = false;

	connection?.setActiveConversation(id);
	if (!messageCache.has(id) && rest) {
		try {
			const msgs = await rest.getMessages(id);
			setCacheMessages(id, msgs);
		} catch (err) {
			console.error('Failed to load messages:', err);
		}
	}
}

export async function deleteConversation(id: string): Promise<void> {
	if (!rest) return;
	try {
		await rest.deleteConversation(id);
		conversations = conversations.filter((c) => c.id !== id);
		if (activeConversationId === id) {
			activeConversationId = null;
		}
		if (streamingConversationId === id) {
			streamingContent = '';
			streaming = false;
			streamingMessageId = null;
			streamingConversationId = null;
		}
		messageCache.delete(id);
	} catch (err) {
		console.error('Failed to delete conversation:', err);
	}
}

export async function shareConversation(id: string): Promise<void> {
	if (!rest) return;
	try {
		const updated = await rest.updateConversation(id, { visibility: 'team' });
		const idx = conversations.findIndex((c) => c.id === id);
		if (idx >= 0) {
			conversations[idx] = updated;
			conversations = [...conversations];
		}
	} catch (err) {
		console.error('Failed to share conversation:', err);
	}
}

/** Manually rename a conversation. Optimistic local update, then persist via the daemon. */
export async function renameConversation(id: string, title: string): Promise<void> {
	const trimmed = title.trim();
	if (!trimmed) return;
	const idx = conversations.findIndex((c) => c.id === id);
	const previousTitle = idx >= 0 ? conversations[idx].title : null;
	if (idx >= 0) {
		conversations[idx] = { ...conversations[idx], title: trimmed };
		conversations = [...conversations];
	}

	if (!rest) return;
	try {
		await rest.updateConversation(id, { title: trimmed });
	} catch (err) {
		console.error('Failed to rename conversation:', err);
		const i = conversations.findIndex((c) => c.id === id);
		if (i >= 0) {
			conversations[i] = { ...conversations[i], title: previousTitle ?? '' };
			conversations = [...conversations];
		}
		lastError = { code: 'rename_failed', message: 'Rename failed — the title was not saved.', partial: false };
	}
}

/** Switch the agent persona for a conversation (or just the selected-for-new-chat
 *  agent when none is active). Optimistic; rolls back on persist failure. */
export async function setConversationAgent(id: string | null, agent: string): Promise<void> {
	const next = resolveAgentKey(agent);
	selectedAgent = next;
	if (!id) return; // no conversation yet — this just primes the next New Chat

	const idx = conversations.findIndex((c) => c.id === id);
	const previous = idx >= 0 ? conversations[idx].agent : null;
	if (previous === next) return;
	if (idx >= 0) {
		conversations[idx] = { ...conversations[idx], agent: next };
		conversations = [...conversations];
	}

	if (!rest) return;
	try {
		await rest.updateConversation(id, { agent: next });
	} catch (err) {
		console.error('Failed to switch agent:', err);
		const i = conversations.findIndex((c) => c.id === id);
		if (i >= 0) {
			conversations[i] = { ...conversations[i], agent: previous };
			conversations = [...conversations];
		}
		lastError = { code: 'agent_switch_failed', message: 'Could not switch agent — change was not saved.', partial: false };
	}
}

/** Shared core of regenerate / edit: truncate the conversation from `fromMessageId`
 *  (inclusive) on the daemon, drop those messages from the cache, then resend. */
async function resendFrom(convId: string, fromMessageId: string, content: string): Promise<void> {
	const msgs = messageCache.get(convId) ?? [];
	const idx = msgs.findIndex((m) => m.id === fromMessageId);
	if (idx >= 0) setCacheMessages(convId, msgs.slice(0, idx));
	try {
		if (rest) {
			await rest.truncateFrom(convId, fromMessageId);
		}
	} catch (err) {
		console.error('Failed to truncate before resend:', err);
	}
	sendMessage(content);
}

/** Regenerate the last assistant reply by re-running the last user turn. */
export async function regenerateLast(): Promise<void> {
	const convId = activeConversationId;
	if (!convId || streaming) return;
	const msgs = messageCache.get(convId) ?? [];
	let lastUserIdx = -1;
	for (let i = msgs.length - 1; i >= 0; i--) {
		if (msgs[i].role === 'user') { lastUserIdx = i; break; }
	}
	if (lastUserIdx < 0) return;
	await resendFrom(convId, msgs[lastUserIdx].id, msgs[lastUserIdx].content);
}

/** Edit a prior user message and resend, truncating the thread from that message. */
export async function editAndResend(messageId: string, newContent: string): Promise<void> {
	const convId = activeConversationId;
	if (!convId || streaming) return;
	const trimmed = newContent.trim();
	if (!trimmed) return;
	await resendFrom(convId, messageId, trimmed);
}

export function sendMessage(content: string): void {
	if (streaming) return;

	const convId = activeConversationId;
	if (!convId) return;

	// Guard on connection status: if the daemon socket isn't up, don't optimistically
	// flip into a streaming state that will never resolve — surface an error instead.
	if (connectionStatus !== 'connected') {
		lastError = {
			code: 'not_connected',
			message:
				connectionStatus === 'error'
					? 'Not connected — please reconnect or sign in again.'
					: 'Connecting to assistant — please wait a moment.',
			partial: false
		};
		return;
	}

	lastError = null;
	streaming = true;
	streamingContent = '';
	streamingMessageId = null;
	streamingToolCalls = [];
	streamingConversationId = convId;

	// Optimistically add user message to cache
	const messages = messageCache.get(convId) ?? [];
	const userMsg: DaemonMessage = {
		id: crypto.randomUUID(),
		conversation_id: convId,
		role: 'user',
		content,
		status: 'complete',
		model: null,
		tokens_used: null,
		emotional_state: null,
		tool_calls: null,
		tool_results: null,
		source: 'odin',
		created_at: new Date().toISOString()
	};
	setCacheMessages(convId, [...messages, userMsg]);

	if (!connection) {
		streaming = false;
		streamingContent = '';
		streamingConversationId = null;
		lastError = { code: 'not_connected', message: 'Not connected to assistant.', partial: false };
		return;
	}
	// 'auto' → omit the model so the daemon runs its tier ladder; else force the pick.
	const turnAgent = resolveAgentKey(activeConversation?.agent ?? selectedAgent);
	connection.sendChat(content, convId, model === 'auto' ? undefined : model, turnAgent);
}

export function cancelStream(): void {
	const convId = streamingConversationId ?? activeConversationId;
	if (streaming && convId) {
		commitPartialMessage(convId, streamingMessageId, streamingContent);
	}
	connection?.cancelStream();
	streaming = false;
	streamingContent = '';
	streamingMessageId = null;
	streamingConversationId = null;
}

export function setModel(newModel: string): void {
	model = newModel;
}

/** Condense the active conversation's earlier turns into a summary (POST /compact). */
export async function compactActiveConversation(instructions?: string): Promise<CompactionResult | null> {
	const convId = activeConversationId;
	if (!convId || !rest) return null;
	try {
		const result = await rest.compactConversation(convId, instructions);
		if (result.compacted) {
			try {
				const msgs = await rest.getMessages(convId);
				setCacheMessages(convId, msgs);
			} catch (err) {
				console.error('Failed to refresh messages after compaction:', err);
			}
			compactionNotice = true;
		}
		return result;
	} catch (err) {
		console.error('Failed to compact conversation:', err);
		return { compacted: false, reason: 'The compaction request failed.' };
	}
}

/** Dismiss the inline "earlier turns compacted" divider. */
export function dismissCompactionNotice(): void {
	compactionNotice = false;
}

export function retryConnection(): void {
	connection?.connect();
}

// ── Getters (for use in components) ──────────────

export function getBifrostState() {
	return {
		get connectionStatus() { return connectionStatus; },
		get notConfigured() { return notConfigured; },
		get conversations() { return conversations; },
		get activeConversationId() { return activeConversationId; },
		get activeConversation() { return activeConversation; },
		get activeAgent() { return activeAgent; },
		get selectedAgent() { return selectedAgent; },
		get activeMessages() { return activeMessages; },
		get streaming() { return activeStreaming; },
		get streamingContent() { return activeStreamingContent; },
		get streamingToolCalls() { return activeStreamingToolCalls; },
		get rawStreaming() { return streaming; },
		get lastError() { return lastError; },
		get model() { return model; },
		get availableModels() { return availableModels; },
		get contextTokens() { return contextTokens; },
		get contextLimit() { return contextLimit; },
		get budgetWarning() { return budgetWarning; },
		get dailyTokens() { return dailyTokens; },
		get dailyLimit() { return dailyLimit; },
		get compactionNotice() { return compactionNotice; },
	};
}

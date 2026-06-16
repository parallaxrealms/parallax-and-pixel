// Bifrost Daemon REST Client (chat-scoped port)
// Handles non-streaming chat operations: conversations, messages, models,
// agent tools, compaction. The full 9realms client also exposed well/research/
// heimdall/thoth/ygg endpoints — those are out of scope for the chat tab and
// were dropped from this port (re-add from 9realms if you bring those tabs over).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface DaemonConversation {
	id: string;
	user_id: string;
	title: string;
	visibility: 'private' | 'team';
	model: string;
	/** Realm-agent persona this conversation is bound to. null ⇒ daemon default. */
	agent: string | null;
	summary: string | null;
	created_at: string;
	updated_at: string;
}

export interface DaemonMessage {
	id: string;
	conversation_id: string;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	status: 'complete' | 'streaming' | 'error';
	model: string | null;
	tokens_used: number | null;
	emotional_state: string | null;
	tool_calls: unknown[] | null;
	tool_results: unknown[] | null;
	source: 'odin' | 'discord';
	created_at: string;
}

export interface DaemonHealth {
	status: 'ok' | 'error';
	uptime: number;
	connections: number;
	supabase: 'connected' | 'error';
}

/** Result of POST /api/conversations/:id/compact — condense earlier turns into a summary.
 *  `compacted` false ⇒ nothing was condensed; `reason` says why (e.g. too few turns). */
export interface CompactionResult {
	compacted: boolean;
	reason?: string;
	summaryPreview?: string;
}

/** One tool in an agent's palette (GET /api/agents/tools) — for the chat /help view. */
export interface AgentToolInfo {
	name: string;
	label: string;
	description: string;
	risk: 'low' | 'medium' | 'high';
}

/** A durable memory the agents have kept (GET /api/memory). */
export interface DaemonMemory {
	id: string;
	/** Owning agent key, or null for a shared memory. */
	agent: string | null;
	category: string;
	content: string;
	importance: number;
	source_conversation_id: string | null;
	last_accessed: string;
	created_at: string;
	updated_at: string;
}

/** One agent automation (scheduled-job master switch) (GET /api/agents/automation). */
export interface AgentAutomation {
	key: string;
	label: string;
	agent: string;
	enabled: boolean;
	cron: string | null;
	timezone: string;
}

/** One row of the daemon's selectable-model catalog (GET /api/models). */
export interface SelectableModel {
	/** 'auto' (let the daemon's tier ladder decide) or a concrete model id. */
	id: string;
	label: string;
	tier?: string;
	provider?: string | null;
	free?: boolean;
	/** Whether a usable key exists for this model's provider. */
	available?: boolean;
	contextWindow?: number;
}

export class DaemonRestClient {
	private baseUrl: string;
	private supabase: SupabaseClient;

	constructor(baseUrl: string, supabase: SupabaseClient) {
		// Strip trailing slash and /ws path if present
		this.baseUrl = baseUrl.replace(/\/ws\/?$/, '').replace(/\/$/, '');
		this.supabase = supabase;
	}

	// ── Health ──────────────────────────────────────

	async health(): Promise<DaemonHealth> {
		const res = await fetch(`${this.baseUrl}/health`);
		if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
		return res.json();
	}

	// ── Conversations ──────────────────────────────

	async listConversations(): Promise<DaemonConversation[]> {
		// The daemon wraps the list: { conversations: [...] }.
		const res = await this.get<{ conversations: DaemonConversation[] }>('/api/conversations');
		return res.conversations ?? [];
	}

	async createConversation(title?: string, agent?: string): Promise<DaemonConversation> {
		// The daemon wraps the row: { conversation: {...} }.
		const res = await this.post<{ conversation: DaemonConversation }>('/api/conversations', { title, agent });
		return res.conversation;
	}

	async deleteConversation(id: string): Promise<void> {
		await this.del(`/api/conversations/${id}`);
	}

	async updateConversation(id: string, updates: { title?: string; visibility?: 'private' | 'team'; agent?: string }): Promise<DaemonConversation> {
		return this.patch(`/api/conversations/${id}`, updates);
	}

	/** Truncate a conversation from `messageId` onward (inclusive). Powers
	 *  regenerate / edit-and-resend: delete from the user turn, then send afresh. */
	async truncateFrom(conversationId: string, messageId: string): Promise<{ deleted: number }> {
		return this.del<{ deleted: number }>(`/api/conversations/${conversationId}/messages/${messageId}`);
	}

	/** Condense a conversation's earlier turns into a summary to reclaim context window.
	 *  `instructions` optionally steers what to keep/emphasize. The daemon decides whether
	 *  there's enough to compact (`compacted: false` + `reason` when not). */
	async compactConversation(conversationId: string, instructions?: string): Promise<CompactionResult> {
		return this.post<CompactionResult>(`/api/conversations/${conversationId}/compact`, { instructions });
	}

	// ── Messages ────────────────────────────────────

	async getMessages(conversationId: string): Promise<DaemonMessage[]> {
		// The daemon wraps the list: { messages: [...] }.
		const res = await this.get<{ messages: DaemonMessage[] }>(`/api/conversations/${conversationId}/messages`);
		return res.messages ?? [];
	}

	// ── Models ──────────────────────────────────────

	/** GET /api/models — the selectable-model catalog for the picker. */
	async listModels(): Promise<{ models: SelectableModel[]; default: string }> {
		return this.get<{ models: SelectableModel[]; default: string }>('/api/models');
	}

	// ── Agent tools (chat /help) ───────────────────

	/** GET /api/agents/tools — the named agent's tool palette + descriptions. */
	async listAgentTools(agent: string): Promise<AgentToolInfo[]> {
		const res = await this.get<{ tools: AgentToolInfo[] }>(`/api/agents/tools?agent=${encodeURIComponent(agent)}`);
		return res.tools ?? [];
	}

	// ── Memory ──────────────────────────────────────

	/** GET /api/memory — durable memories the agents have kept. Optional `q`
	 *  (search) and `agent` (filter) narrow server-side; the daemon wraps the
	 *  list: { memories: [...] }. */
	async listMemories(opts?: { q?: string; agent?: string }): Promise<DaemonMemory[]> {
		const params = new URLSearchParams();
		if (opts?.q) params.set('q', opts.q);
		if (opts?.agent) params.set('agent', opts.agent);
		const qs = params.toString();
		const res = await this.get<{ memories: DaemonMemory[] }>(`/api/memory${qs ? `?${qs}` : ''}`);
		return res.memories ?? [];
	}

	// ── Agent automation (scheduled-job master switches) ──

	/** GET /api/agents/automation — every agent's scheduled-job master switch. */
	async getAgentAutomation(): Promise<AgentAutomation[]> {
		const res = await this.get<{ automations: AgentAutomation[] }>('/api/agents/automation');
		return res.automations ?? [];
	}

	/** POST /api/agents/automation — flip one automation on/off. */
	async setAgentAutomation(key: string, enabled: boolean): Promise<{ key: string; enabled: boolean }> {
		return this.post<{ key: string; enabled: boolean }>('/api/agents/automation', { key, enabled });
	}

	// ── Private: HTTP helpers ──────────────────────

	private async getAuthHeaders(): Promise<Record<string, string>> {
		const { data } = await this.supabase.auth.getSession();
		const token = data.session?.access_token;
		if (!token) throw new Error('Not authenticated');
		return {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
		};
	}

	private async get<T>(path: string): Promise<T> {
		const headers = await this.getAuthHeaders();
		const res = await fetch(`${this.baseUrl}${path}`, { headers });
		if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
		return res.json();
	}

	private async post<T>(path: string, body: unknown): Promise<T> {
		const headers = await this.getAuthHeaders();
		const res = await fetch(`${this.baseUrl}${path}`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		});
		if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
		const text = await res.text();
		return (text ? JSON.parse(text) : undefined) as T;
	}

	private async patch<T>(path: string, body: unknown): Promise<T> {
		const headers = await this.getAuthHeaders();
		const res = await fetch(`${this.baseUrl}${path}`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify(body),
		});
		if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status} ${res.statusText}`);
		return res.json();
	}

	private async del<T = void>(path: string): Promise<T> {
		const headers = await this.getAuthHeaders();
		const res = await fetch(`${this.baseUrl}${path}`, {
			method: 'DELETE',
			headers,
		});
		if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status} ${res.statusText}`);
		// 204 (delete conversation) has no body; the truncate route returns JSON.
		const text = await res.text();
		return (text ? JSON.parse(text) : undefined) as T;
	}
}

// POST /api/bifrost/usage — token-usage reporting endpoint the daemon POSTs to.
//
// The Bifrost daemon records real token spend here so the Settings/Overview
// usage panels (and the budget checks in `$lib/data/bifrost/chat/budget.ts`)
// reflect live usage. Auth: shared `BIFROST_API_KEY` bearer (no Supabase JWT);
// the daemon supplies `user_id` in the body. Writes go via the service-role
// admin client into `public.bifrost_token_usage` (bypasses RLS).
//
// Body: {
//   user_id: string,            // required, uuid
//   conversation_id?: string,
//   input_tokens: number,       // required, non-negative integer
//   output_tokens: number,      // required, non-negative integer
//   model?: string,
//   billable?: boolean,         // default true; false for $0 OpenRouter :free models
//   cost_usd?: number,          // provider-reported USD cost (0 for free)
//   estimated?: boolean         // default false (daemon-reported real spend)
// }
//
// Returns 204 on success.

import { json, type RequestHandler } from '@sveltejs/kit';
import { requireBifrostAuth } from '$lib/server/bifrost/auth';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';

interface UsageBody {
	user_id?: unknown;
	conversation_id?: unknown;
	input_tokens?: unknown;
	output_tokens?: unknown;
	model?: unknown;
	billable?: unknown;
	cost_usd?: unknown;
	estimated?: unknown;
}

// Largest per-exchange cost we'll accept, so a malformed report can't poison
// spend accounting. Chat exchanges are cents; $1000 is comfortably absurd.
const MAX_COST_USD = 1000;

function asCostUsd(v: unknown): number {
	if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 0;
	return Math.min(v, MAX_COST_USD);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sane upper bound per token-count field so a caller can't poison budget
// accounting with absurd values (e.g. Number.MAX_SAFE_INTEGER).
const MAX_TOKEN_COUNT = 10_000_000;

function asTokenCount(v: unknown): number | null {
	if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
	const n = Math.floor(v);
	if (n > MAX_TOKEN_COUNT) return null;
	return n;
}

export const POST: RequestHandler = async (event) => {
	const auth = requireBifrostAuth(event);
	if (!auth.ok) return auth.response;

	let body: UsageBody;
	try {
		body = (await event.request.json()) as UsageBody;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (typeof body.user_id !== 'string' || !UUID_RE.test(body.user_id.trim())) {
		return json({ error: '`user_id` (uuid string) is required' }, { status: 400 });
	}

	const inputTokens = asTokenCount(body.input_tokens);
	const outputTokens = asTokenCount(body.output_tokens);
	if (inputTokens === null) {
		return json(
			{ error: '`input_tokens` must be a non-negative integer <= 10000000' },
			{ status: 400 }
		);
	}
	if (outputTokens === null) {
		return json(
			{ error: '`output_tokens` must be a non-negative integer <= 10000000' },
			{ status: 400 }
		);
	}

	// billable defaults true when omitted (older daemon builds) so usage still
	// counts; only an explicit `false` (a $0 :free model) excludes it from spend.
	// estimated defaults false (the daemon reports real spend); an explicit true
	// flags a client-side estimate. conversation_id is free-form text — the
	// daemon's SQLite conversation id, not an FK into any table.
	const billable = body.billable !== false;
	const estimated = body.estimated === true;

	const row = {
		user_id: body.user_id.trim(),
		conversation_id:
			typeof body.conversation_id === 'string' ? body.conversation_id.slice(0, 200) : null,
		input_tokens: inputTokens,
		output_tokens: outputTokens,
		model: typeof body.model === 'string' ? body.model.slice(0, 100) : null,
		billable,
		cost_usd: asCostUsd(body.cost_usd),
		estimated
	};

	const sb = getSupabaseAdmin();
	const { error } = await sb.from('bifrost_token_usage').insert(row);
	if (error) {
		console.error('[bifrost/usage] insert failed:', error);
		return json({ error: 'Failed to record token usage' }, { status: 500 });
	}

	return new Response(null, { status: 204 });
};

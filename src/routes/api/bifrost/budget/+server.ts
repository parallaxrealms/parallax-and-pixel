// GET /api/bifrost/budget?userId=<uuid> — budget-config read endpoint.
//
// The Bifrost daemon reads the user-configured token budget here so it can
// enforce the same limits the operator set in the Bifrost Settings UI (the
// daemon also has its own hard daily cost cap, independent of this). Auth:
// shared `BIFROST_API_KEY` bearer. Reads `public.bifrost_budget_config` via the
// service-role admin client, falling back to DEFAULT_CONFIG when no row exists.
//
// Query: ?userId=<uuid>  (required)

import { json, type RequestHandler } from '@sveltejs/kit';
import { requireBifrostAuth } from '$lib/server/bifrost/auth';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';
import { DEFAULT_CONFIG } from '$lib/data/bifrost/chat/budget';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async (event) => {
	const auth = requireBifrostAuth(event);
	if (!auth.ok) return auth.response;

	const userId = event.url.searchParams.get('userId')?.trim();
	if (!userId) {
		return json({ error: '`userId` query param is required' }, { status: 400 });
	}
	if (!UUID_RE.test(userId)) {
		return json({ error: '`userId` must be a uuid' }, { status: 400 });
	}

	const sb = getSupabaseAdmin();
	const { data, error } = await sb
		.from('bifrost_budget_config')
		.select('daily_limit, monthly_limit, per_conversation_limit, warning_threshold')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		console.error('[bifrost/budget] read failed:', error);
		return json({ error: 'Failed to read budget config' }, { status: 500 });
	}

	const cfg = data ?? DEFAULT_CONFIG;

	return json({
		user_id: userId,
		daily_limit: cfg.daily_limit,
		monthly_limit: cfg.monthly_limit,
		per_conversation_limit: cfg.per_conversation_limit,
		warning_threshold: cfg.warning_threshold
	});
};

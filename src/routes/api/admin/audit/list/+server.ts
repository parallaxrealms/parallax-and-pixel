import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin-guard';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';

/**
 * GET /api/admin/audit/list — recent audits for the admin table. Admin-only.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	const admin = getSupabaseAdmin();
	const { data, error } = await admin
		.from('audits')
		.select('id, url, status, scores, step_label, error, pdf_storage_key, created_at, completed_at')
		.order('created_at', { ascending: false })
		.limit(100);

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ audits: data ?? [] });
};

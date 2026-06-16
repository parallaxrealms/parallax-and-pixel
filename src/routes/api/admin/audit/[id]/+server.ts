import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin-guard';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';

/**
 * GET /api/admin/audit/[id] — one audit (status/scores/findings) for polling +
 * the detail view. Admin-only.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	const admin = getSupabaseAdmin();
	const { data: audit, error } = await admin
		.from('audits')
		.select(
			'id, url, status, scores, signals, step_label, error, pdf_storage_key, created_at, completed_at'
		)
		.eq('id', params.id)
		.maybeSingle();

	if (error) return json({ error: error.message }, { status: 500 });
	if (!audit) return json({ error: 'Not found.' }, { status: 404 });

	const { data: findings } = await admin
		.from('audit_findings')
		.select('pillar, severity, title, description, fix')
		.eq('audit_id', params.id);

	return json({ audit, findings: findings ?? [] });
};

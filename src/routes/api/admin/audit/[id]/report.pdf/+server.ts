import { error as kitError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin-guard';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';
import { streamAuditPdf } from '$lib/server/audit/pdf/serve';

/**
 * GET /api/admin/audit/[id]/report.pdf — stream the stored PDF. Admin-only.
 * `?dl=1` forces a download (Content-Disposition: attachment).
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	const admin = getSupabaseAdmin();
	const { data: audit } = await admin
		.from('audits')
		.select('id, url, pdf_storage_key, created_at, completed_at')
		.eq('id', params.id)
		.maybeSingle();

	if (!audit || !audit.pdf_storage_key) {
		throw kitError(404, 'No PDF for this audit yet.');
	}

	const res = await streamAuditPdf({
		storageKey: audit.pdf_storage_key as string,
		url: audit.url as string,
		datedAt: (audit.completed_at as string | null) ?? (audit.created_at as string),
		download: url.searchParams.get('dl') === '1'
	});

	if (!res) throw kitError(404, 'PDF not found in storage.');
	return res;
};

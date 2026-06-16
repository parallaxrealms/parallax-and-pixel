import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin-guard';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';
import { normalizeAndValidateUrl } from '$lib/server/audit/urlValidate';
import { wakeAuditWorker } from '$lib/server/audit/worker';

/**
 * POST /api/admin/audit/run — enqueue a new website audit.
 * Body: { url: string }. Admin-only. Inserts a status='queued' row and wakes
 * the durable worker; returns { id } so the UI can poll for results.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	let body: { url?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}

	const v = normalizeAndValidateUrl(body.url ?? '');
	if (!v.ok) return json({ error: v.error }, { status: 400 });

	const session = await locals.getSession();
	const admin = getSupabaseAdmin();
	const { data, error } = await admin
		.from('audits')
		.insert({
			url: v.url,
			url_input: (body.url ?? v.url).trim(),
			status: 'queued',
			requested_by: session?.user?.id ?? null
		})
		.select('id')
		.single();

	if (error || !data) {
		return json({ error: error?.message ?? 'Could not enqueue audit.' }, { status: 500 });
	}

	wakeAuditWorker();
	return json({ id: data.id });
};

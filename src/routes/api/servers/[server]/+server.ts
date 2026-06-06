import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-guard';
import { fetchGlancesSnapshot, isGlancesConfigured } from '$lib/server/glances';

/**
 * Server-stats proxy. Admin-only — /api routes are NOT covered by the
 * (admin) layout guard, so the session + role check happens here.
 *
 * GET /api/servers/<id>  →  sanitized Glances snapshot for that server.
 * Credentials never leave the server.
 */

const ALLOWED = /^[a-z0-9_-]{1,32}$/;

export const GET: RequestHandler = async ({ params, locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	const id = params.server ?? '';
	if (!ALLOWED.test(id)) throw error(400, 'invalid server id');
	if (!isGlancesConfigured(id)) {
		return json({ configured: false, snapshot: null }, { status: 200 });
	}
	try {
		const snapshot = await fetchGlancesSnapshot(id);
		return json({ configured: true, snapshot });
	} catch (e) {
		return json(
			{ configured: true, snapshot: null, error: e instanceof Error ? e.message : String(e) },
			{ status: 502 }
		);
	}
};

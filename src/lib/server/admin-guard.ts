import { json } from '@sveltejs/kit';

/**
 * Admin gate for /api routes. The (admin) layout guard does NOT cover /api,
 * so handlers that expose admin-only data must verify the session + role
 * themselves. This replicates the exact pattern used by
 * @parallaxrealms/pxp-utils/api-auth's createAdminUsersHandler:
 *   1. locals.getSession() — JWT-validated session from hooks.server.ts
 *   2. user_roles lookup via locals.supabase (RLS lets a user read own role)
 *   3. allow admin | power-user
 *
 * Returns null when the caller is an admin, otherwise a 401/403 JSON Response
 * the handler should return as-is.
 */
export async function requireAdmin(locals: App.Locals): Promise<Response | null> {
	const session = await locals.getSession();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { data: roleData } = await locals.supabase
		.from('user_roles')
		.select('role')
		.eq('user_id', session.user.id)
		.single();

	if (
		!roleData ||
		(roleData.role !== 'admin' && roleData.role !== 'power-user')
	) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	return null;
}

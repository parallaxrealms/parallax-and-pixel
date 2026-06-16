import { createAdminUsersHandler } from '@parallaxrealms/pxp-utils/api-auth';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_KEY } from '$env/static/private';

/**
 * GET /api/admin/users
 * Fetch all users with their profiles, roles, and storage quota/usage
 * Uses enhanced handler from api-auth with storage data
 */
export const GET = createAdminUsersHandler({
	getServiceRoleClient: () =>
		createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_KEY, {
			auth: { persistSession: false }
		})
});

import { createStorageQuotaHandler } from '@parallaxrealms/api-auth';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SATORI_KEY } from '$env/static/private';

/**
 * POST /api/admin/users/quota
 * Update storage quota for a user
 * Requires admin role
 */
export const POST = createStorageQuotaHandler({
	getServiceRoleClient: () =>
		createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SATORI_KEY, {
			auth: { persistSession: false }
		})
});

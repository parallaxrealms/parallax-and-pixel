import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SITE_ID } from '$env/static/public';
import { PRIVATE_SUPABASE_SATORI_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

const siteId = PUBLIC_SITE_ID || 'unknown';

function getServiceClient() {
	return createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SATORI_KEY, {
		auth: { persistSession: false }
	});
}

/** GET - Paginated history with optional filters */
export const GET: RequestHandler = async ({ url, locals }) => {
	const session = await locals.getSession();
	if (!session?.user) throw error(401, 'Unauthorized');

	const supabase = getServiceClient();

	// Verify admin role
	const { data: role } = await supabase
		.schema('pxp')
		.from('user_roles')
		.select('role')
		.eq('user_id', session.user.id)
		.single();

	if (!role || (role.role !== 'admin' && role.role !== 'power-user')) {
		throw error(403, 'Admin access required');
	}

	// Parse query params
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
	const platform = url.searchParams.get('platform');
	const status = url.searchParams.get('status');
	const offset = (page - 1) * limit;

	// Build query
	let query = supabase
		.schema('pxp')
		.from('social_posts')
		.select('*', { count: 'exact' })
		.eq('site_id', siteId)
		.order('posted_at', { ascending: false })
		.range(offset, offset + limit - 1);

	if (platform) query = query.eq('platform', platform);
	if (status) query = query.eq('status', status);

	const { data, error: dbError, count } = await query;

	if (dbError) throw error(500, dbError.message);

	return json({
		posts: data || [],
		total: count || 0,
		page,
		limit
	});
};

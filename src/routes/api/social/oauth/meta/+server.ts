import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { META_APP_ID, META_APP_SECRET, PRIVATE_SUPABASE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/social/oauth/meta
 *
 * Initiates Meta OAuth flow for Instagram + Facebook.
 * Query params:
 *   - platform: 'instagram' | 'facebook'
 *
 * Required Meta App permissions:
 *   Instagram: instagram_basic, instagram_content_publish, pages_show_list
 *   Facebook:  pages_manage_posts, pages_read_engagement
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const session = await locals.getSession();
	if (!session?.user) throw error(401, 'Unauthorized');

	// Verify admin
	const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_KEY, {
		auth: { persistSession: false }
	});
	const { data: role } = await supabase
		.from('user_roles')
		.select('role')
		.eq('user_id', session.user.id)
		.single();

	if (!role || (role.role !== 'admin' && role.role !== 'power-user')) {
		throw error(403, 'Admin access required');
	}

	if (!META_APP_ID || !META_APP_SECRET) {
		throw error(500, 'Meta App credentials not configured. Set META_APP_ID and META_APP_SECRET in .env');
	}

	const platform = url.searchParams.get('platform') || 'instagram';
	const origin = url.origin;
	const redirectUri = `${origin}/api/social/oauth/meta/callback`;

	// Scopes differ by platform
	const scopes =
		platform === 'instagram'
			? 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'
			: 'pages_manage_posts,pages_read_engagement,pages_show_list';

	// State encodes platform for the callback
	const state = JSON.stringify({ platform });
	const encodedState = Buffer.from(state).toString('base64url');

	const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
	authUrl.searchParams.set('client_id', META_APP_ID);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('scope', scopes);
	authUrl.searchParams.set('state', encodedState);
	authUrl.searchParams.set('response_type', 'code');

	throw redirect(302, authUrl.toString());
};

import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TIKTOK_CLIENT_KEY, PRIVATE_SUPABASE_SATORI_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/social/oauth/tiktok
 *
 * Initiates TikTok OAuth 2.0 Authorization Code flow.
 * Required scopes: user.info.basic, video.publish
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const session = await locals.getSession();
	if (!session?.user) throw error(401, 'Unauthorized');

	// Verify admin
	const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SATORI_KEY, {
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

	if (!TIKTOK_CLIENT_KEY) {
		throw error(500, 'TikTok credentials not configured. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env');
	}

	const origin = url.origin;
	const redirectUri = `${origin}/api/social/oauth/tiktok/callback`;

	const state = Buffer.from(
		JSON.stringify({ ts: Date.now() })
	).toString('base64url');

	// TikTok uses their own auth domain
	const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
	authUrl.searchParams.set('client_key', TIKTOK_CLIENT_KEY);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('scope', 'user.info.basic,video.publish');
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('state', state);

	throw redirect(302, authUrl.toString());
};

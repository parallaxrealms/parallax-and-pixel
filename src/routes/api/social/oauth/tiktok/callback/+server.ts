import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, PRIVATE_SUPABASE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { encryptCredentials } from '$lib/server/crypto';

/**
 * GET /api/social/oauth/tiktok/callback
 *
 * Handles TikTok OAuth callback. Exchanges code for tokens,
 * fetches user info, and stores encrypted credentials.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const session = await locals.getSession();
	if (!session?.user) throw error(401, 'Unauthorized');

	const code = url.searchParams.get('code');
	const stateParam = url.searchParams.get('state');
	const errorParam = url.searchParams.get('error');

	if (errorParam) {
		throw redirect(302, '/dashboard?social_error=' + encodeURIComponent(errorParam));
	}

	if (!code || !stateParam) {
		throw error(400, 'Missing code or state parameter');
	}

	const origin = url.origin;
	const redirectUri = `${origin}/api/social/oauth/tiktok/callback`;

	try {
		// Step 1: Exchange code for access token
		const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_key: TIKTOK_CLIENT_KEY,
				client_secret: TIKTOK_CLIENT_SECRET,
				code,
				grant_type: 'authorization_code',
				redirect_uri: redirectUri
			})
		});

		const tokenData = await tokenRes.json();

		if (tokenData.error || !tokenData.access_token) {
			throw new Error(
				`Token exchange failed: ${tokenData.error_description || tokenData.error || 'Unknown error'}`
			);
		}

		const accessToken = tokenData.access_token;
		const refreshToken = tokenData.refresh_token;
		const openId = tokenData.open_id;
		const expiresIn = tokenData.expires_in || 86400; // default 24h

		// Step 2: Get user info for display name
		const userRes = await fetch(
			'https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url',
			{
				headers: { Authorization: `Bearer ${accessToken}` }
			}
		);

		const userData = await userRes.json();
		const displayName = userData.data?.user?.display_name || 'TikTok Account';

		// Step 3: Store credentials
		const encrypted = encryptCredentials({
			access_token: accessToken,
			refresh_token: refreshToken,
			open_id: openId
		});

		const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

		const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_KEY, {
			auth: { persistSession: false }
		});

		await supabase
			.from('social_integrations')
			.upsert(
				{
					platform: 'tiktok',
					display_name: `TikTok (${displayName})`,
					is_enabled: true,
					encrypted_credentials: encrypted,
					oauth_expires_at: expiresAt,
					oauth_scope: 'user.info.basic,video.publish',
					created_by: session.user.id,
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'platform,display_name' }
			);

		throw redirect(302, '/dashboard?tab=social&connected=tiktok');
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
			throw err; // Re-throw redirects
		}
		console.error('TikTok OAuth callback error:', err);
		const message = err instanceof Error ? err.message : 'OAuth failed';
		throw redirect(302, '/dashboard?tab=social&social_error=' + encodeURIComponent(message));
	}
};

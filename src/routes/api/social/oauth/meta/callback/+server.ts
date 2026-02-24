import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { META_APP_ID, META_APP_SECRET, PRIVATE_SUPABASE_SATORI_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { encryptCredentials } from '$lib/server/crypto';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

/**
 * GET /api/social/oauth/meta/callback
 *
 * Handles the Meta OAuth callback. Exchanges code for tokens,
 * converts to long-lived token, fetches Page/Instagram account info,
 * and stores encrypted credentials.
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

	// Decode state
	let platform: string;
	try {
		const state = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
		platform = state.platform;
	} catch {
		throw error(400, 'Invalid state parameter');
	}

	const origin = url.origin;
	const redirectUri = `${origin}/api/social/oauth/meta/callback`;

	try {
		// Step 1: Exchange code for short-lived user token
		const tokenUrl = new URL(`${GRAPH_API}/oauth/access_token`);
		tokenUrl.searchParams.set('client_id', META_APP_ID);
		tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
		tokenUrl.searchParams.set('redirect_uri', redirectUri);
		tokenUrl.searchParams.set('code', code);

		const tokenRes = await fetch(tokenUrl.toString());
		const tokenData = await tokenRes.json();

		if (tokenData.error) {
			throw new Error(`Token exchange failed: ${tokenData.error.message}`);
		}

		const shortLivedToken = tokenData.access_token;

		// Step 2: Exchange for long-lived token (~60 days)
		const longLivedUrl = new URL(`${GRAPH_API}/oauth/access_token`);
		longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
		longLivedUrl.searchParams.set('client_id', META_APP_ID);
		longLivedUrl.searchParams.set('client_secret', META_APP_SECRET);
		longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

		const longLivedRes = await fetch(longLivedUrl.toString());
		const longLivedData = await longLivedRes.json();

		if (longLivedData.error) {
			throw new Error(`Long-lived token failed: ${longLivedData.error.message}`);
		}

		const userAccessToken = longLivedData.access_token;
		const expiresIn = longLivedData.expires_in || 5184000; // default 60 days

		// Step 3: Get user's Pages (need Page tokens for posting)
		const pagesRes = await fetch(
			`${GRAPH_API}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`
		);
		const pagesData = await pagesRes.json();

		if (pagesData.error || !pagesData.data?.length) {
			throw new Error('No Facebook Pages found. You need a Page to post.');
		}

		// Use the first Page (user can configure in the future)
		const page = pagesData.data[0];
		const pageAccessToken = page.access_token; // Page tokens from long-lived user tokens are also long-lived
		const pageId = page.id;
		const pageName = page.name;

		const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SATORI_KEY, {
			auth: { persistSession: false }
		});

		const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

		if (platform === 'instagram') {
			// Get the Instagram Business Account ID linked to this Page
			const igAccountId = page.instagram_business_account?.id;

			if (!igAccountId) {
				throw new Error(
					'No Instagram Business account linked to this Page. ' +
					'Connect a Professional Instagram account to your Facebook Page first.'
				);
			}

			const encrypted = encryptCredentials({
				access_token: pageAccessToken,
				user_id: igAccountId
			});

			await supabase
				.from('social_integrations')
				.upsert(
					{
						platform: 'instagram',
						display_name: `Instagram (${pageName})`,
						is_enabled: true,
						encrypted_credentials: encrypted,
						oauth_expires_at: expiresAt,
						oauth_scope: 'instagram_basic,instagram_content_publish',
						created_by: session.user.id,
						updated_at: new Date().toISOString()
					},
					{ onConflict: 'platform,display_name' }
				);
		} else {
			// Facebook Page
			const encrypted = encryptCredentials({
				access_token: pageAccessToken,
				page_id: pageId
			});

			await supabase
				.from('social_integrations')
				.upsert(
					{
						platform: 'facebook',
						display_name: `Facebook (${pageName})`,
						is_enabled: true,
						encrypted_credentials: encrypted,
						oauth_expires_at: expiresAt,
						oauth_scope: 'pages_manage_posts,pages_read_engagement',
						created_by: session.user.id,
						updated_at: new Date().toISOString()
					},
					{ onConflict: 'platform,display_name' }
				);
		}

		// Redirect back to dashboard social tab
		throw redirect(302, '/dashboard?tab=social&connected=' + platform);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
			throw err; // Re-throw redirects
		}
		console.error('Meta OAuth callback error:', err);
		const message = err instanceof Error ? err.message : 'OAuth failed';
		throw redirect(302, '/dashboard?tab=social&social_error=' + encodeURIComponent(message));
	}
};

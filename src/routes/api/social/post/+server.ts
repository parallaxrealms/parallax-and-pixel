import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_SUPABASE_SATORI_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { decryptCredentials } from '$lib/server/crypto';
import { postToPlatform } from '$lib/server/social/router';
import type { ComposePostRequest, SocialIntegration, SocialPlatform } from '$lib/types/social';
import type { PostPayload } from '$lib/server/social/types';

function getServiceClient() {
	return createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SATORI_KEY, {
		auth: { persistSession: false }
	});
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.getSession();
	if (!session?.user) throw error(401, 'Unauthorized');

	const supabase = getServiceClient();

	// Verify admin role
	const { data: role } = await supabase
		.from('user_roles')
		.select('role')
		.eq('user_id', session.user.id)
		.single();

	if (!role || (role.role !== 'admin' && role.role !== 'power-user')) {
		throw error(403, 'Admin access required');
	}

	const body: ComposePostRequest = await request.json();
	const { content, platforms, image_urls, link_url, link_title, page_id, page_slug } = body;

	if (!content?.trim()) throw error(400, 'Content is required');
	if (!platforms?.length) throw error(400, 'At least one platform is required');

	// Fetch matching integrations
	const { data: integrations, error: dbError } = await supabase
		.from('social_integrations')
		.select('*')
		.eq('is_enabled', true)
		.in('platform', platforms);

	if (dbError) throw error(500, dbError.message);

	if (!integrations?.length) {
		throw error(400, 'No enabled integrations found for the selected platforms');
	}

	const payload: PostPayload = {
		content,
		imageUrls: image_urls,
		linkUrl: link_url,
		linkTitle: link_title
	};

	// Post to each platform in parallel
	const results = await Promise.allSettled(
		(integrations as SocialIntegration[]).map(async (integration) => {
			const credentials = decryptCredentials(integration.encrypted_credentials);
			const result = await postToPlatform(integration.platform, credentials, payload);

			// Log to social_posts table
			await supabase
				.from('social_posts')
				.insert({
					integration_id: integration.id,
					platform: integration.platform,
					content,
					image_urls: image_urls || [],
					page_id: page_id || null,
					page_slug: page_slug || null,
					status: result.success ? 'success' : 'failed',
					platform_post_id: result.platformPostId || null,
					platform_response: result.response || null,
					error_message: result.error || null,
					posted_by: session.user.id,
					posted_at: new Date().toISOString()
				});

			return {
				platform: integration.platform,
				display_name: integration.display_name,
				...result
			};
		})
	);

	const platformResults = results.map((r) => {
		if (r.status === 'fulfilled') return r.value;
		return {
			platform: 'unknown' as SocialPlatform,
			display_name: 'Unknown',
			success: false,
			error: r.reason?.message || 'Unexpected error'
		};
	});

	const successCount = platformResults.filter((r) => r.success).length;
	const overallStatus =
		successCount === platformResults.length
			? 'success'
			: successCount > 0
				? 'partial'
				: 'failed';

	return json({
		status: overallStatus,
		results: platformResults
	});
};

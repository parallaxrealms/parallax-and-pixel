import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SATORI_KEY } from '$env/static/private';
import { decryptCredentials } from '$lib/server/crypto';
import { postToPlatform } from '$lib/server/social/router';
import type { SocialIntegration } from '$lib/types/social';
import type { PostPayload } from '$lib/server/social/types';

let initialized = false;

function getServiceClient() {
	return createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SATORI_KEY, {
		auth: { persistSession: false }
	});
}

async function processScheduledSocialPosts() {
	const supabase = getServiceClient();

	try {
		// Find due posts
		const { data: duePosts, error: fetchError } = await supabase
			.from('scheduled_social_posts')
			.select('*')
			.eq('status', 'scheduled')
			.lte('scheduled_at', new Date().toISOString());

		if (fetchError || !duePosts?.length) return;

		for (const scheduledPost of duePosts) {
			// Optimistic lock: mark as processing
			const { error: lockError } = await supabase
				.from('scheduled_social_posts')
				.update({ status: 'processing' })
				.eq('id', scheduledPost.id)
				.eq('status', 'scheduled');

			if (lockError) continue; // Another instance grabbed it

			try {
				// Fetch integrations for the platforms
				const { data: integrations, error: intError } = await supabase
					.from('social_integrations')
					.select('*')
					.eq('is_enabled', true)
					.in('platform', scheduledPost.platforms);

				if (intError || !integrations?.length) {
					await supabase
						.from('scheduled_social_posts')
						.update({ status: 'failed', error_message: 'No enabled integrations found' })
						.eq('id', scheduledPost.id);
					continue;
				}

				const payload: PostPayload = {
					content: scheduledPost.content,
					imageUrls: scheduledPost.image_urls?.length ? scheduledPost.image_urls : undefined,
					linkUrl: scheduledPost.link_url || undefined,
					linkTitle: scheduledPost.link_title || undefined
				};

				let allSuccess = true;
				let anySuccess = false;

				// Post to each platform
				for (const integration of integrations as SocialIntegration[]) {
					try {
						const credentials = decryptCredentials(integration.encrypted_credentials);
						const result = await postToPlatform(integration.platform, credentials, payload);

						// Log to social_posts audit table
						await supabase
							.from('social_posts')
							.insert({
								integration_id: integration.id,
								platform: integration.platform,
								content: scheduledPost.content,
								image_urls: scheduledPost.image_urls || [],
								page_id: scheduledPost.page_id || null,
								page_slug: scheduledPost.page_slug || null,
								status: result.success ? 'success' : 'failed',
								platform_post_id: result.platformPostId || null,
								platform_response: result.response || null,
								error_message: result.error || null,
								posted_by: scheduledPost.created_by,
								posted_at: new Date().toISOString()
							});

						if (result.success) anySuccess = true;
						else allSuccess = false;
					} catch (e) {
						allSuccess = false;
						console.error(`[cron] Failed to post to ${integration.platform}:`, e);
					}
				}

				// Mark scheduled post as completed or failed
				await supabase
					.from('scheduled_social_posts')
					.update({
						status: anySuccess ? 'completed' : 'failed',
						error_message: allSuccess ? null : 'Some platforms failed'
					})
					.eq('id', scheduledPost.id);
			} catch (e) {
				console.error('[cron] Error processing scheduled post:', e);
				await supabase
					.from('scheduled_social_posts')
					.update({
						status: 'failed',
						error_message: e instanceof Error ? e.message : 'Unknown error'
					})
					.eq('id', scheduledPost.id);
			}
		}
	} catch (e) {
		console.error('[cron] Error in processScheduledSocialPosts:', e);
	}
}

export function initCronJobs() {
	if (initialized) return;
	initialized = true;

	// Run every minute
	cron.schedule('* * * * *', () => {
		processScheduledSocialPosts();
	});

	console.log('[cron] Social post scheduler initialized');
}

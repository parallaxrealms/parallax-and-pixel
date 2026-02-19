import type { TikTokCredentials } from '$lib/types/social';
import type { PostPayload, PostResult } from './types';

const TIKTOK_API = 'https://open.tiktokapis.com/v2';

/**
 * Post to TikTok via the Content Posting API.
 *
 * TikTok is video-first. For image posts, TikTok supports "photo mode"
 * (carousel of images as a post) via the direct post API.
 *
 * Requires `video.publish` or `video.upload` scope.
 */
export async function postToTiktok(
	credentials: Record<string, unknown>,
	payload: PostPayload
): Promise<PostResult> {
	const { access_token, open_id } = credentials as unknown as TikTokCredentials;

	if (!access_token || !open_id) {
		return { success: false, error: 'Missing TikTok access token or open ID' };
	}

	try {
		// TikTok Content Posting API supports photo posts (images) and video posts.
		// For social sharing, we'll use the photo post flow with direct URLs.
		if (!payload.imageUrls?.length) {
			return {
				success: false,
				error: 'TikTok requires images or video. Text-only posts are not supported.'
			};
		}

		// Use the Direct Post API for photo mode
		// Photo posts accept 1-35 images
		const postData = {
			post_info: {
				title: payload.content.slice(0, 2200), // TikTok caption limit
				disable_comment: false,
				privacy_level: 'PUBLIC_TO_EVERYONE' as const,
				auto_add_music: true
			},
			source_info: {
				source: 'PULL_FROM_URL' as const,
				photo_images: payload.imageUrls.slice(0, 35) // TikTok supports up to 35 photos
			},
			media_type: 'PHOTO' as const
		};

		const res = await fetch(`${TIKTOK_API}/post/publish/content/init/`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${access_token}`,
				'Content-Type': 'application/json; charset=UTF-8'
			},
			body: JSON.stringify(postData)
		});

		const data = await res.json();

		if (data.error?.code !== 'ok' && data.error?.code) {
			return {
				success: false,
				error: `TikTok API error: ${data.error.message || data.error.code}`
			};
		}

		const publishId = data.data?.publish_id;

		if (!publishId) {
			return { success: false, error: 'TikTok did not return a publish ID' };
		}

		// Check publish status (TikTok processes asynchronously)
		// We'll do a few status checks with backoff
		for (let attempt = 0; attempt < 5; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));

			const statusRes = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${access_token}`,
					'Content-Type': 'application/json; charset=UTF-8'
				},
				body: JSON.stringify({ publish_id: publishId })
			});

			const statusData = await statusRes.json();
			const status = statusData.data?.status;

			if (status === 'PUBLISH_COMPLETE') {
				return {
					success: true,
					platformPostId: publishId,
					response: statusData
				};
			} else if (status === 'FAILED') {
				return {
					success: false,
					error: `TikTok publish failed: ${statusData.data?.fail_reason || 'Unknown reason'}`
				};
			}
			// PROCESSING_UPLOAD or PROCESSING_DOWNLOAD — keep waiting
		}

		// If we get here, it's still processing. Return success optimistically
		// since TikTok may take longer for larger media.
		return {
			success: true,
			platformPostId: publishId,
			response: { note: 'Post submitted, still processing on TikTok' }
		};
	} catch (err) {
		return {
			success: false,
			error: `TikTok posting failed: ${err instanceof Error ? err.message : String(err)}`
		};
	}
}

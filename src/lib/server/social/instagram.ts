import type { InstagramCredentials } from '$lib/types/social';
import type { PostPayload, PostResult } from './types';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

/**
 * Post to Instagram via the Graph API (Content Publishing API).
 * Two-step process: 1) Create media container  2) Publish container
 *
 * Requires a Professional (Business/Creator) Instagram account
 * connected to a Facebook Page, with a Page access token that has
 * `instagram_basic`, `instagram_content_publish` permissions.
 */
export async function postToInstagram(
	credentials: Record<string, unknown>,
	payload: PostPayload
): Promise<PostResult> {
	const { access_token, user_id } = credentials as unknown as InstagramCredentials;

	if (!access_token || !user_id) {
		return { success: false, error: 'Missing Instagram access token or user ID' };
	}

	try {
		// Instagram requires at least one image for feed posts.
		// If no image, post as a text-only story (not supported via API) — use caption-only with link.
		if (payload.imageUrls?.length) {
			if (payload.imageUrls.length === 1) {
				// Single image post
				return await publishSingleImage(access_token, user_id, payload);
			} else {
				// Carousel post (2-10 images)
				return await publishCarousel(access_token, user_id, payload);
			}
		} else {
			// Text-only: Instagram doesn't support text-only feed posts via API.
			// We can still attempt if there's a link with an image preview.
			return {
				success: false,
				error: 'Instagram requires at least one image for feed posts'
			};
		}
	} catch (err) {
		return {
			success: false,
			error: `Instagram posting failed: ${err instanceof Error ? err.message : String(err)}`
		};
	}
}

async function publishSingleImage(
	accessToken: string,
	userId: string,
	payload: PostPayload
): Promise<PostResult> {
	// Step 1: Create media container
	const containerParams = new URLSearchParams({
		image_url: payload.imageUrls![0],
		caption: payload.content,
		access_token: accessToken
	});

	const containerRes = await fetch(`${GRAPH_API}/${userId}/media`, {
		method: 'POST',
		body: containerParams
	});

	const containerData = await containerRes.json();

	if (containerData.error) {
		return { success: false, error: `Container creation failed: ${containerData.error.message}` };
	}

	const containerId = containerData.id;

	// Step 2: Publish the container (may need to wait for processing)
	return await publishContainer(accessToken, userId, containerId);
}

async function publishCarousel(
	accessToken: string,
	userId: string,
	payload: PostPayload
): Promise<PostResult> {
	const imageUrls = payload.imageUrls!.slice(0, 10); // Instagram max 10 carousel items

	// Step 1: Create individual item containers
	const itemIds: string[] = [];

	for (const imageUrl of imageUrls) {
		const params = new URLSearchParams({
			image_url: imageUrl,
			is_carousel_item: 'true',
			access_token: accessToken
		});

		const res = await fetch(`${GRAPH_API}/${userId}/media`, {
			method: 'POST',
			body: params
		});

		const data = await res.json();
		if (data.error) {
			return { success: false, error: `Carousel item failed: ${data.error.message}` };
		}
		itemIds.push(data.id);
	}

	// Step 2: Create carousel container
	const carouselParams = new URLSearchParams({
		media_type: 'CAROUSEL',
		caption: payload.content,
		access_token: accessToken
	});
	// children must be comma-separated list
	carouselParams.set('children', itemIds.join(','));

	const carouselRes = await fetch(`${GRAPH_API}/${userId}/media`, {
		method: 'POST',
		body: carouselParams
	});

	const carouselData = await carouselRes.json();
	if (carouselData.error) {
		return { success: false, error: `Carousel creation failed: ${carouselData.error.message}` };
	}

	// Step 3: Publish
	return await publishContainer(accessToken, userId, carouselData.id);
}

async function publishContainer(
	accessToken: string,
	userId: string,
	containerId: string,
	maxRetries = 5
): Promise<PostResult> {
	// Instagram may need time to process the container. Poll status before publishing.
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		// Check container status
		const statusRes = await fetch(
			`${GRAPH_API}/${containerId}?fields=status_code&access_token=${accessToken}`
		);
		const statusData = await statusRes.json();

		if (statusData.status_code === 'FINISHED') {
			// Ready to publish
			const publishParams = new URLSearchParams({
				creation_id: containerId,
				access_token: accessToken
			});

			const publishRes = await fetch(`${GRAPH_API}/${userId}/media_publish`, {
				method: 'POST',
				body: publishParams
			});

			const publishData = await publishRes.json();

			if (publishData.error) {
				return { success: false, error: `Publish failed: ${publishData.error.message}` };
			}

			return {
				success: true,
				platformPostId: publishData.id,
				response: publishData
			};
		} else if (statusData.status_code === 'ERROR') {
			return { success: false, error: 'Instagram media processing failed' };
		}

		// Wait before retrying (exponential backoff: 2s, 4s, 8s, 16s, 32s)
		await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, attempt)));
	}

	return { success: false, error: 'Instagram media processing timed out' };
}

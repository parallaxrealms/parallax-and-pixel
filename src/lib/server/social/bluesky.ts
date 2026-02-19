import { AtpAgent, RichText } from '@atproto/api';
import type { BlueskyCredentials } from '$lib/types/social';
import type { PostPayload, PostResult } from './types';

export async function postToBluesky(
	credentials: Record<string, unknown>,
	payload: PostPayload
): Promise<PostResult> {
	const { identifier, app_password } = credentials as unknown as BlueskyCredentials;

	if (!identifier || !app_password) {
		return { success: false, error: 'Missing Bluesky identifier or app password' };
	}

	try {
		const agent = new AtpAgent({ service: 'https://bsky.social' });

		await agent.login({ identifier, password: app_password });

		// Create rich text with facet detection (links, mentions, hashtags)
		const rt = new RichText({ text: payload.content });
		await rt.detectFacets(agent);

		const post: Record<string, unknown> = {
			$type: 'app.bsky.feed.post',
			text: rt.text,
			facets: rt.facets,
			createdAt: new Date().toISOString()
		};

		// Upload images (max 4 on Bluesky)
		if (payload.imageUrls?.length) {
			const images: { alt: string; image: unknown }[] = [];

			for (const url of payload.imageUrls.slice(0, 4)) {
				try {
					const imgResponse = await fetch(url);
					const imgBuffer = await imgResponse.arrayBuffer();
					const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

					const uploadResult = await agent.uploadBlob(new Uint8Array(imgBuffer), {
						encoding: mimeType
					});

					images.push({
						alt: '',
						image: uploadResult.data.blob
					});
				} catch (imgErr) {
					console.error(`Failed to upload image to Bluesky: ${url}`, imgErr);
				}
			}

			if (images.length > 0) {
				post.embed = {
					$type: 'app.bsky.embed.images',
					images
				};
			}
		} else if (payload.linkUrl && !payload.imageUrls?.length) {
			// Use external embed for links (only when no images)
			post.embed = {
				$type: 'app.bsky.embed.external',
				external: {
					uri: payload.linkUrl,
					title: payload.linkTitle || '',
					description: ''
				}
			};
		}

		const result = await agent.post(post);

		return {
			success: true,
			platformPostId: result.uri,
			response: result
		};
	} catch (err) {
		return {
			success: false,
			error: `Bluesky posting failed: ${err instanceof Error ? err.message : String(err)}`
		};
	}
}

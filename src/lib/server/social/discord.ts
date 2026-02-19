import type { DiscordCredentials } from '$lib/types/social';
import type { PostPayload, PostResult } from './types';

export async function postToDiscord(
	credentials: Record<string, unknown>,
	payload: PostPayload
): Promise<PostResult> {
	const { webhook_url } = credentials as unknown as DiscordCredentials;

	if (!webhook_url) {
		return { success: false, error: 'Missing webhook URL' };
	}

	try {
		// Build the webhook body
		const body: Record<string, unknown> = {
			content: payload.content
		};

		// Add embeds for images and links
		const embeds: Record<string, unknown>[] = [];

		if (payload.linkUrl) {
			embeds.push({
				title: payload.linkTitle || payload.linkUrl,
				url: payload.linkUrl,
				color: 0x00a5cf // accent-primary
			});
		}

		if (payload.imageUrls?.length) {
			// First image as main embed image
			if (embeds.length > 0) {
				embeds[0].image = { url: payload.imageUrls[0] };
			} else {
				embeds.push({ image: { url: payload.imageUrls[0] } });
			}

			// Additional images as separate embeds (Discord supports up to 10)
			for (let i = 1; i < Math.min(payload.imageUrls.length, 10); i++) {
				embeds.push({ image: { url: payload.imageUrls[i] } });
			}
		}

		if (embeds.length > 0) {
			body.embeds = embeds;
		}

		const response = await fetch(webhook_url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		// Discord webhooks return 204 No Content on success
		if (response.ok || response.status === 204) {
			return {
				success: true,
				response: { status: response.status }
			};
		}

		const errorText = await response.text();
		return {
			success: false,
			error: `Discord API error (${response.status}): ${errorText}`
		};
	} catch (err) {
		return {
			success: false,
			error: `Discord posting failed: ${err instanceof Error ? err.message : String(err)}`
		};
	}
}

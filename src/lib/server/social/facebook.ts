import type { FacebookCredentials } from '$lib/types/social';
import type { PostPayload, PostResult } from './types';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

/**
 * Post to a Facebook Page via the Graph API.
 * Requires a Page access token with `pages_manage_posts` permission.
 */
export async function postToFacebook(
	credentials: Record<string, unknown>,
	payload: PostPayload
): Promise<PostResult> {
	const { access_token, page_id } = credentials as unknown as FacebookCredentials;

	if (!access_token || !page_id) {
		return { success: false, error: 'Missing Facebook access token or page ID' };
	}

	try {
		if (payload.imageUrls?.length) {
			if (payload.imageUrls.length === 1) {
				return await postWithSinglePhoto(access_token, page_id, payload);
			} else {
				return await postWithMultiplePhotos(access_token, page_id, payload);
			}
		} else {
			return await postTextOnly(access_token, page_id, payload);
		}
	} catch (err) {
		return {
			success: false,
			error: `Facebook posting failed: ${err instanceof Error ? err.message : String(err)}`
		};
	}
}

/** Text/link post to /{page-id}/feed */
async function postTextOnly(
	accessToken: string,
	pageId: string,
	payload: PostPayload
): Promise<PostResult> {
	const params: Record<string, string> = {
		message: payload.content,
		access_token: accessToken
	};

	if (payload.linkUrl) {
		params.link = payload.linkUrl;
	}

	const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params)
	});

	const data = await res.json();

	if (data.error) {
		return { success: false, error: `Facebook API error: ${data.error.message}` };
	}

	return {
		success: true,
		platformPostId: data.id,
		response: data
	};
}

/** Single photo post to /{page-id}/photos */
async function postWithSinglePhoto(
	accessToken: string,
	pageId: string,
	payload: PostPayload
): Promise<PostResult> {
	const params = {
		url: payload.imageUrls![0],
		caption: payload.content,
		access_token: accessToken
	};

	const res = await fetch(`${GRAPH_API}/${pageId}/photos`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params)
	});

	const data = await res.json();

	if (data.error) {
		return { success: false, error: `Facebook photo post failed: ${data.error.message}` };
	}

	return {
		success: true,
		platformPostId: data.post_id || data.id,
		response: data
	};
}

/** Multi-photo post: upload each as unpublished, then create feed post linking them */
async function postWithMultiplePhotos(
	accessToken: string,
	pageId: string,
	payload: PostPayload
): Promise<PostResult> {
	const photoIds: string[] = [];

	// Upload each photo as unpublished
	for (const imageUrl of payload.imageUrls!.slice(0, 10)) {
		const params = {
			url: imageUrl,
			published: false,
			access_token: accessToken
		};

		const res = await fetch(`${GRAPH_API}/${pageId}/photos`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params)
		});

		const data = await res.json();
		if (data.error) {
			return { success: false, error: `Photo upload failed: ${data.error.message}` };
		}
		photoIds.push(data.id);
	}

	// Create feed post with attached photos
	const feedParams: Record<string, unknown> = {
		message: payload.content,
		access_token: accessToken,
		attached_media: photoIds.map((id) => ({ media_fbid: id }))
	};

	const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(feedParams)
	});

	const data = await res.json();

	if (data.error) {
		return { success: false, error: `Multi-photo post failed: ${data.error.message}` };
	}

	return {
		success: true,
		platformPostId: data.id,
		response: data
	};
}

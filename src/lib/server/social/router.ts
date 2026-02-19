import type { SocialPlatform } from '$lib/types/social';
import type { PostPayload, PostResult, PlatformPoster } from './types';
import { postToDiscord } from './discord';
import { postToBluesky } from './bluesky';
import { postToInstagram } from './instagram';
import { postToFacebook } from './facebook';
import { postToTiktok } from './tiktok';

const platformPosters: Record<SocialPlatform, PlatformPoster> = {
	discord: postToDiscord,
	bluesky: postToBluesky,
	instagram: postToInstagram,
	facebook: postToFacebook,
	tiktok: postToTiktok
};

export async function postToPlatform(
	platform: SocialPlatform,
	credentials: Record<string, unknown>,
	payload: PostPayload
): Promise<PostResult> {
	const poster = platformPosters[platform];
	return poster(credentials, payload);
}

export function isPlatformSupported(platform: SocialPlatform): boolean {
	return platform in platformPosters;
}

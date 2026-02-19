import type { SocialPlatform } from '$lib/types/social';

export interface PostPayload {
	content: string;
	imageUrls?: string[];
	linkUrl?: string;
	linkTitle?: string;
}

export interface PostResult {
	success: boolean;
	platformPostId?: string;
	response?: unknown;
	error?: string;
}

export type PlatformPoster = (
	credentials: Record<string, unknown>,
	payload: PostPayload
) => Promise<PostResult>;

export interface PlatformModule {
	platform: SocialPlatform;
	post: PlatformPoster;
}

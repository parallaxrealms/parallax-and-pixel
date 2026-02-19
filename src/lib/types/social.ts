// Social Media Posting Types

export type SocialPlatform = 'discord' | 'bluesky' | 'instagram' | 'facebook' | 'tiktok';

export interface SocialIntegration {
	id: string;
	site_id: string;
	platform: SocialPlatform;
	display_name: string;
	is_enabled: boolean;
	encrypted_credentials: string;
	oauth_expires_at: string | null;
	oauth_scope: string | null;
	created_at: string;
	updated_at: string;
	created_by: string;
}

/** Client-safe version - no credentials */
export interface SocialIntegrationClient {
	id: string;
	site_id: string;
	platform: SocialPlatform;
	display_name: string;
	is_enabled: boolean;
	has_credentials: boolean;
	oauth_expires_at: string | null;
	oauth_scope: string | null;
	created_at: string;
	updated_at: string;
}

export type SocialPostStatus = 'pending' | 'success' | 'failed' | 'partial';

export interface SocialPost {
	id: string;
	site_id: string;
	integration_id: string;
	platform: SocialPlatform;
	content: string;
	image_urls: string[];
	page_id: string | null;
	page_slug: string | null;
	status: SocialPostStatus;
	platform_post_id: string | null;
	platform_response: Record<string, unknown> | null;
	error_message: string | null;
	posted_by: string;
	posted_at: string;
	created_at: string;
}

export interface ComposePostRequest {
	content: string;
	platforms: SocialPlatform[];
	image_urls?: string[];
	link_url?: string;
	link_title?: string;
	page_id?: string;
	page_slug?: string;
}

// Per-platform credential shapes
export interface DiscordCredentials {
	webhook_url: string;
}

export interface BlueskyCredentials {
	identifier: string;
	app_password: string;
}

export interface InstagramCredentials {
	access_token: string;
	user_id: string;
}

export interface FacebookCredentials {
	access_token: string;
	page_id: string;
}

export interface TikTokCredentials {
	access_token: string;
	open_id: string;
}

export type PlatformCredentials =
	| DiscordCredentials
	| BlueskyCredentials
	| InstagramCredentials
	| FacebookCredentials
	| TikTokCredentials;

export interface PlatformConfig {
	name: string;
	icon: string;
	color: string;
	maxChars: number;
	supportsImages: boolean;
	requiresOAuth: boolean;
}

export const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
	discord: {
		name: 'Discord',
		icon: 'discord',
		color: '#5865F2',
		maxChars: 2000,
		supportsImages: true,
		requiresOAuth: false
	},
	bluesky: {
		name: 'Bluesky',
		icon: 'bluesky',
		color: '#0085FF',
		maxChars: 300,
		supportsImages: true,
		requiresOAuth: false
	},
	instagram: {
		name: 'Instagram',
		icon: 'instagram',
		color: '#E1306C',
		maxChars: 2200,
		supportsImages: true,
		requiresOAuth: true
	},
	facebook: {
		name: 'Facebook',
		icon: 'facebook',
		color: '#1877F2',
		maxChars: 63206,
		supportsImages: true,
		requiresOAuth: true
	},
	tiktok: {
		name: 'TikTok',
		icon: 'tiktok',
		color: '#000000',
		maxChars: 2200,
		supportsImages: false,
		requiresOAuth: true
	}
};

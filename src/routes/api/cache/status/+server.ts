import { createCacheStatusHandler } from '@parallaxrealms/api-auth';
import { PUBLIC_SITE_ID } from '$env/static/public';

export const GET = createCacheStatusHandler({
	siteId: PUBLIC_SITE_ID
});

import { createCacheRefreshHandler } from '@parallaxrealms/pxp-utils/api-auth';
import { PUBLIC_SITE_ID } from '$env/static/public';

export const POST = createCacheRefreshHandler({
	siteId: PUBLIC_SITE_ID
});

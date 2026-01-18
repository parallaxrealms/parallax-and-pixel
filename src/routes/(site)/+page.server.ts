import type { PageServerLoad } from './$types';
import { PUBLIC_SITE_ID } from '$env/static/public';
import { loadWithCacheFirst, EDDA_TABLE_CONFIGS } from '@parallaxrealms/api-auth';
import type { Page } from '@parallaxrealms/types-edda';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const siteId = PUBLIC_SITE_ID || '5176'; // edda = 5176

	// Get parent layout data (includes navbarLinks, siteOptions)
	const parentData = await parent();

	// Get pages table config
	const pagesConfig = EDDA_TABLE_CONFIGS.find((c) => c.table === 'pages')!;

	// Fetch published pages using cache-first strategy
	const pagesResult = await loadWithCacheFirst<Page>(locals.supabase, '.cache', siteId, pagesConfig);

	return {
		...parentData,
		pages: pagesResult.data || []
	};
};

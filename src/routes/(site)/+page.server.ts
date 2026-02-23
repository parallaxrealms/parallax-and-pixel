import type { PageServerLoad } from './$types';
import { PUBLIC_SITE_ID } from '$env/static/public';
import type { Page } from '@parallaxrealms/types-edda';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const siteId = PUBLIC_SITE_ID || '5176';

	// Get parent layout data (includes navbarLinks, website)
	const parentData = await parent();

	// Fetch published pages directly from database for latest posts
	const { data: pages } = await locals.supabase
		.schema('pxp')
		.from('pages')
		.select('id, title, slug, meta_description, created_at, status')
		.eq('site_id', siteId)
		.eq('status', 'published')
		.order('created_at', { ascending: false })
		.limit(5);

	return {
		...parentData,
		pages: (pages || []) as Page[]
	};
};

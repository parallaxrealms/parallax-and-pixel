import type { PageServerLoad } from './$types';
import type { Page } from '@parallaxrealms/types-edda';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get parent layout data (includes navbarLinks, website)
	const parentData = await parent();

	// Fetch published pages directly from database for latest posts
	const { data: pages } = await locals.supabase
		.from('pages')
		.select('id, title, slug, meta_description, created_at, status')
		.eq('status', 'published')
		.order('created_at', { ascending: false })
		.limit(5);

	return {
		...parentData,
		pages: (pages || []) as Page[]
	};
};

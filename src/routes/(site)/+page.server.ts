import type { PageServerLoad } from './$types';
import type { Page } from '@parallaxrealms/pxp-types/edda';

export const load: PageServerLoad = async ({ locals, parent }) => {
	// Get parent layout data (includes navbarLinks, website)
	const parentData = await parent();

	// Fetch published blog posts for the hero's Latest Posts panel.
	// page_type = 'page' rows are CMS pages, not blog posts — exclude them.
	const { data: pages } = await locals.supabase
		.from('pages')
		.select('id, title, slug, meta_description, created_at, status')
		.eq('status', 'published')
		.or('page_options->>page_type.neq.page,page_options->>page_type.is.null')
		.order('created_at', { ascending: false })
		.limit(5);

	return {
		...parentData,
		pages: (pages || []) as Page[]
	};
};

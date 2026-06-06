import type { PageServerLoad } from './$types';
import type { Page } from '$lib';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { slug } = params;

	// Load published CMS page by slug. Only page_type = 'page' renders here —
	// blog posts (page_type = 'blog_post' or unset) live at /blog/[slug].
	const { data: page, error: pageError } = await locals.supabase
		.from('pages')
		.select('*')
		.eq('slug', slug)
		.eq('status', 'published')
		.eq('page_options->>page_type', 'page')
		.single();

	if (pageError || !page) {
		error(404, { message: 'Page not found', errorId: 'PAGE_NOT_FOUND' });
	}

	return {
		page: page as Page
	};
};

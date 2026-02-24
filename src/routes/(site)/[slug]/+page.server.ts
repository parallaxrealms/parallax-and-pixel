import type { PageServerLoad } from './$types';
import type { Page } from '$lib';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { slug } = params;

	// Load published page by slug
	const { data: page, error: pageError } = await locals.supabase
		.from('pages')
		.select('*')
		.eq('slug', slug)
		.eq('status', 'published')
		.single();

	if (pageError || !page) {
		error(404, { message: 'Page not found', errorId: 'PAGE_NOT_FOUND' });
	}

	return {
		page: page as Page
	};
};

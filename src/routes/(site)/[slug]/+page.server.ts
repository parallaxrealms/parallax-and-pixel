import type { PageServerLoad } from './$types';
import type { Page } from '$lib';
import { PUBLIC_SITE_ID } from '$env/static/public';
import { error } from '@sveltejs/kit';

const siteId = PUBLIC_SITE_ID || 'default';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { slug } = params;

	// Load published page by slug
	const { data: page, error: pageError } = await locals.supabase
		.schema('pxp')
		.from('pages')
		.select('*')
		.eq('site_id', siteId)
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

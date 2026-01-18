import type { PageServerLoad } from './$types';
import type { Page } from '$lib';
import { PUBLIC_SITE_ID } from '$env/static/public';

const siteId = PUBLIC_SITE_ID || 'default';

export const load: PageServerLoad = async ({ locals, url }) => {
	const searchQuery = url.searchParams.get('q') || '';

	// Build query for published blog posts
	let query = locals.supabase
		.schema('pxp')
		.from('pages')
		.select('id, title, slug, meta_description, banner_image_url, created_at, updated_at')
		.eq('site_id', siteId)
		.eq('status', 'published')
		.order('created_at', { ascending: false });

	// Add search filter if query provided
	if (searchQuery) {
		query = query.ilike('title', `%${searchQuery}%`);
	}

	const { data: posts, error } = await query;

	if (error) {
		console.error('Error fetching blog posts:', error);
	}

	return {
		posts: (posts || []) as Page[],
		searchQuery
	};
};

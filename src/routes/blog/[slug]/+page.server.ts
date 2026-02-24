import type { PageServerLoad } from './$types';
import type { Page } from '$lib';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { slug } = params;

	// Load published page by slug
	const { data: post, error: postError } = await locals.supabase
		.from('pages')
		.select('*')
		.eq('slug', slug)
		.eq('status', 'published')
		.single();

	if (postError || !post) {
		error(404, { message: 'Post not found', errorId: 'POST_NOT_FOUND' });
	}

	// Get related posts (other published posts, excluding current)
	const { data: relatedPosts } = await locals.supabase
		.from('pages')
		.select('id, title, slug, meta_description, banner_image_url, created_at')
		.eq('status', 'published')
		.neq('slug', slug)
		.order('created_at', { ascending: false })
		.limit(3);

	return {
		post: post as Page,
		relatedPosts: (relatedPosts || []) as Page[]
	};
};

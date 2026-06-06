import type { PageServerLoad } from './$types';
import type { Page } from '$lib';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { slug } = params;

	// Blog posts are page_type = 'blog_post' or unset; page_type = 'page' is a
	// CMS page served at /(site)/[slug] and must not render at /blog/[slug].
	const BLOG_FILTER = 'page_options->>page_type.neq.page,page_options->>page_type.is.null';

	// Load published blog post by slug
	const { data: post, error: postError } = await locals.supabase
		.from('pages')
		.select('*')
		.eq('slug', slug)
		.eq('status', 'published')
		.or(BLOG_FILTER)
		.single();

	if (postError || !post) {
		error(404, { message: 'Post not found', errorId: 'POST_NOT_FOUND' });
	}

	// Get related posts (other published posts, excluding current)
	const { data: relatedPosts } = await locals.supabase
		.from('pages')
		.select('id, title, slug, meta_description, banner_image_url, created_at')
		.eq('status', 'published')
		.or(BLOG_FILTER)
		.neq('slug', slug)
		.order('created_at', { ascending: false })
		.limit(3);

	return {
		post: post as Page,
		relatedPosts: (relatedPosts || []) as Page[]
	};
};

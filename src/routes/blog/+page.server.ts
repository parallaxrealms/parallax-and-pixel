import type { PageServerLoad } from './$types';
import type { Page } from '$lib';

// Extract plain text from TipTap/Edda JSON content (server-side)
function extractTextFromContent(content: unknown, maxLength: number = 150): string {
	if (!content || typeof content !== 'object') return '';
	const texts: string[] = [];
	function traverse(node: unknown) {
		if (!node || typeof node !== 'object') return;
		const n = node as Record<string, unknown>;
		if (n.type === 'text' && typeof n.text === 'string') texts.push(n.text);
		if (Array.isArray(n.content)) for (const child of n.content) traverse(child);
	}
	traverse(content);
	const fullText = texts.join(' ').replace(/\s+/g, ' ').trim();
	return fullText.length <= maxLength ? fullText : fullText.slice(0, maxLength).trim() + '...';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const searchQuery = url.searchParams.get('q') || '';
	const categoryFilter = url.searchParams.get('category') || '';

	// Blog posts are page_type = 'blog_post' or unset; page_type = 'page' is a
	// CMS page served at /(site)/[slug] and must not appear in blog listings.
	const BLOG_FILTER = 'page_options->>page_type.neq.page,page_options->>page_type.is.null';

	// Fetch all distinct categories for the filter
	const { data: categoriesData } = await locals.supabase
		.from('pages')
		.select('category')
		.eq('status', 'published')
		.or(BLOG_FILTER)
		.not('category', 'is', null);

	// Extract unique categories
	const categories = [...new Set(
		(categoriesData || [])
			.map((p: { category: string | null }) => p.category)
			.filter((c): c is string => c !== null && c.trim() !== '')
	)].sort();

	// Build query for published blog posts
	let query = locals.supabase
		.from('pages')
		.select('id, title, slug, meta_description, banner_image_url, created_at, updated_at, category, content')
		.eq('status', 'published')
		.or(BLOG_FILTER)
		.order('created_at', { ascending: false });

	// Add search filter if query provided
	if (searchQuery) {
		query = query.ilike('title', `%${searchQuery}%`);
	}

	// Add category filter if provided
	if (categoryFilter) {
		query = query.eq('category', categoryFilter);
	}

	const { data: posts, error } = await query;

	if (error) {
		console.error('Error fetching blog posts:', error);
	}

	// Extract text previews server-side and strip heavy content JSONB from response
	const postsWithPreviews = (posts || []).map((post: any) => {
		const preview = post.meta_description || extractTextFromContent(post.content, 150);
		const { content: _, ...rest } = post;
		return { ...rest, preview };
	});

	// Fetch 5 most recent posts for sidebar (unfiltered)
	const { data: recentPosts } = await locals.supabase
		.from('pages')
		.select('id, title, slug, created_at')
		.eq('status', 'published')
		.or(BLOG_FILTER)
		.order('created_at', { ascending: false })
		.limit(5);

	return {
		posts: postsWithPreviews as Page[],
		recentPosts: (recentPosts || []) as Page[],
		categories,
		searchQuery,
		categoryFilter
	};
};

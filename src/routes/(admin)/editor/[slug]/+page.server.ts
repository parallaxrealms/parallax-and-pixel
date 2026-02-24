import type { PageServerLoad, Actions } from './$types';
import type { Page } from '$lib';
import { PUBLIC_SITE_ID } from '$env/static/public';
import { error, fail } from '@sveltejs/kit';
import { refreshTableCache, EDDA_TABLE_CONFIGS, type TableQueryConfig } from '@parallaxrealms/api-auth';

const siteId = PUBLIC_SITE_ID || 'default';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { slug } = params;

	// Load page by slug
	const { data: page, error: pageError } = await locals.supabase
		.from('pages')
		.select('*')
		.eq('slug', slug)
		.single();

	if (pageError) {
		// If page not found, we might be creating a new one
		if (pageError.code === 'PGRST116') {
			return {
				page: null,
				slug,
				isNew: true
			};
		}
		console.error('Error loading page:', pageError);
		throw error(500, { message: 'Failed to load page' });
	}

	return {
		page: page as Page,
		slug,
		isNew: false
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const formData = await request.formData();
		const title = formData.get('title') as string;
		const content = formData.get('content') as string;
		const status = formData.get('status') as string;
		const metaDescription = formData.get('meta_description') as string;
		const category = formData.get('category') as string;
		const pageStylesData = formData.get('page_styles') as string;
		const scheduledAt = formData.get('scheduled_at') as string;
		const isNew = formData.get('is_new') === 'true';

		if (!title?.trim()) {
			return fail(400, { error: 'Title is required' });
		}

		const session = await locals.getSession();
		if (!session) {
			return fail(401, { error: 'Unauthorized' });
		}

		let contentJson = null;
		if (content) {
			try {
				contentJson = JSON.parse(content);
			} catch {
				return fail(400, { error: 'Invalid content format' });
			}
		}

		// Parse page styles (background + text color)
		let pageStylesJson: Record<string, unknown> | null = null;
		if (pageStylesData) {
			try {
				pageStylesJson = JSON.parse(pageStylesData);
			} catch {
				// Ignore invalid page styles
			}
		}

		// For updates, fetch existing page_options to preserve other settings
		let existingOptions: Record<string, unknown> = {};
		if (!isNew) {
			const { data: existingPage } = await locals.supabase
				.from('pages')
				.select('page_options')
				.eq('slug', params.slug)
				.single();
			existingOptions = (existingPage?.page_options as Record<string, unknown>) ?? {};
		}

		// Validate scheduled status
		if (status === 'scheduled') {
			if (!scheduledAt) {
				return fail(400, { error: 'Scheduled date is required' });
			}
			const scheduledDate = new Date(scheduledAt);
			if (isNaN(scheduledDate.getTime())) {
				return fail(400, { error: 'Invalid scheduled date' });
			}
			if (scheduledDate <= new Date()) {
				return fail(400, { error: 'Scheduled date must be in the future' });
			}
		}

		// Merge new styles into existing page_options
		const pageOptions: Record<string, unknown> = {
			...existingOptions,
			...(pageStylesJson?.background !== undefined ? { background: pageStylesJson.background } : {}),
			...(pageStylesJson?.textColorLight !== undefined ? { textColorLight: pageStylesJson.textColorLight } : {}),
			...(pageStylesJson?.textColorDark !== undefined ? { textColorDark: pageStylesJson.textColorDark } : {}),
			...(pageStylesJson?.scrollingText !== undefined ? { scrollingText: pageStylesJson.scrollingText } : {}),
			...(pageStylesJson?.scheduled_at !== undefined ? { scheduled_at: pageStylesJson.scheduled_at } : {})
		};

		// Clear scheduled_at from page_options when not scheduling
		if (status !== 'scheduled') {
			delete pageOptions.scheduled_at;
		}

		const pageData = {
			title: title.trim(),
			content: contentJson,
			status: status || 'draft',
			meta_description: metaDescription?.trim() || null,
			category: category?.trim() || null,
			page_options: pageOptions,
			last_modified_by: session.user.id,
			...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
			...(status === 'scheduled' ? { published_at: null } : {})
		};

		if (isNew) {
			// Create new page
			const { data, error: insertError } = await locals.supabase
				.from('pages')
				.insert({
					slug: params.slug,
					...pageData
				})
				.select()
				.single();

			if (insertError) {
				console.error('Error creating page:', insertError);
				return fail(500, { error: 'Failed to create page' });
			}

			// Refresh pages cache after successful create
			const pagesConfig = EDDA_TABLE_CONFIGS.find((c: TableQueryConfig) => c.table === 'website_pages')!;
			await refreshTableCache(locals.supabase, '.cache', siteId, pagesConfig, session.user.id);

			return { success: true, page: data };
		} else {
			// Update existing page
			const { data, error: updateError } = await locals.supabase
				.from('pages')
				.update(pageData)
				.eq('slug', params.slug)
				.select()
				.single();

			if (updateError) {
				console.error('Error updating page:', updateError);
				return fail(500, { error: 'Failed to update page' });
			}

			// Refresh pages cache after successful update
			const pagesConfig = EDDA_TABLE_CONFIGS.find((c: TableQueryConfig) => c.table === 'website_pages')!;
			await refreshTableCache(locals.supabase, '.cache', siteId, pagesConfig, session.user.id);

			return { success: true, page: data };
		}
	}
};

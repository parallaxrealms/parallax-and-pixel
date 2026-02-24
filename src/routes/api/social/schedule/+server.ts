import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_SUPABASE_SATORI_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import type { SchedulePostRequest } from '$lib/types/social';

function getServiceClient() {
	return createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SATORI_KEY, {
		auth: { persistSession: false }
	});
}

async function verifyAdmin(locals: App.Locals) {
	const session = await locals.getSession();
	if (!session?.user) throw error(401, 'Unauthorized');

	const supabase = getServiceClient();
	const { data: role } = await supabase
		.from('user_roles')
		.select('role')
		.eq('user_id', session.user.id)
		.single();

	if (!role || (role.role !== 'admin' && role.role !== 'power-user')) {
		throw error(403, 'Admin access required');
	}

	return { session, supabase };
}

/** POST: Create a scheduled social post */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, supabase } = await verifyAdmin(locals);

	const body: SchedulePostRequest = await request.json();
	const { content, platforms, image_urls, link_url, link_title, page_id, page_slug, scheduled_at } = body;

	if (!content?.trim()) throw error(400, 'Content is required');
	if (!platforms?.length) throw error(400, 'At least one platform is required');
	if (!scheduled_at) throw error(400, 'Scheduled time is required');

	const scheduledDate = new Date(scheduled_at);
	if (isNaN(scheduledDate.getTime())) throw error(400, 'Invalid scheduled date');
	if (scheduledDate <= new Date()) throw error(400, 'Scheduled time must be in the future');

	const { data, error: dbError } = await supabase
		.from('scheduled_social_posts')
		.insert({
			content: content.trim(),
			platforms,
			image_urls: image_urls || [],
			link_url: link_url || null,
			link_title: link_title || null,
			page_id: page_id || null,
			page_slug: page_slug || null,
			scheduled_at: scheduledDate.toISOString(),
			status: 'scheduled',
			created_by: session.user.id
		})
		.select()
		.single();

	if (dbError) throw error(500, dbError.message);

	return json({ success: true, post: data });
};

/** GET: List scheduled posts (pending) */
export const GET: RequestHandler = async ({ locals }) => {
	const { supabase } = await verifyAdmin(locals);

	const { data, error: dbError } = await supabase
		.from('scheduled_social_posts')
		.select('*')
		.in('status', ['scheduled', 'processing'])
		.order('scheduled_at', { ascending: true });

	if (dbError) throw error(500, dbError.message);

	return json({ posts: data || [] });
};

/** DELETE: Cancel a scheduled post */
export const DELETE: RequestHandler = async ({ url, locals }) => {
	const { supabase } = await verifyAdmin(locals);

	const id = url.searchParams.get('id');
	if (!id) throw error(400, 'Post ID is required');

	const { error: dbError } = await supabase
		.from('scheduled_social_posts')
		.update({ status: 'cancelled' })
		.eq('id', id)
		.eq('status', 'scheduled');

	if (dbError) throw error(500, dbError.message);

	return json({ success: true });
};

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { PUBLIC_SITE_ID } from '$env/static/public';

export const load: LayoutServerLoad = async ({ locals: { supabase, getSession }, setHeaders }) => {
	// Prevent caching of protected pages
	setHeaders({
		'cache-control': 'no-store'
	});

	const session = await getSession();

	if (!session?.user) {
		throw redirect(303, '/auth');
	}

	const userId = session.user.id;

	// Parallel fetch on server (auth guaranteed, no client-side race conditions)
	const [roleResult, profileResult, notificationsResult, ticketsResult] = await Promise.all([
		supabase.from('user_roles').select('role').eq('user_id', userId).single(),
		supabase
			.from('user_profiles')
			.select('full_name, username, user_settings')
			.eq('user_id', userId)
			.single(),
		supabase
			.from('notifications')
			.select('*')
			.eq('site_id', PUBLIC_SITE_ID)
			.eq('user_id', userId)
			.order('created_at', { ascending: false }),
		supabase
			.from('support_tickets')
			.select('*')
			.eq('site_id', PUBLIC_SITE_ID)
			.order('created_at', { ascending: false })
	]);

	// Filter tickets based on role (admin/power-user sees all, others see only their own)
	const isAdminRole = roleResult.data?.role === 'admin' || roleResult.data?.role === 'power-user';
	const supportTickets = isAdminRole
		? ticketsResult.data || []
		: (ticketsResult.data || []).filter((t: { user_id: string }) => t.user_id === userId);

	const dashboardData = {
		userRole: (roleResult.data?.role as 'admin' | 'power-user' | 'user' | 'client') || 'user',
		userId,
		userEmail: session.user.email || null,
		userName: profileResult.data?.full_name || profileResult.data?.username || null,
		notifications: notificationsResult.data || [],
		userSettings: profileResult.data?.user_settings || null,
		supportTickets
	};

	return { dashboardData };
};

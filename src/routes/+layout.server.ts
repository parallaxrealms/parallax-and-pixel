import type { LayoutServerLoad } from './$types';
import type { NavbarLink } from '$lib';
import { PUBLIC_SITE_ID } from '$env/static/public';
import { loadWithCacheFirst, EDDA_TABLE_CONFIGS } from '@parallaxrealms/api-auth';

export const load: LayoutServerLoad = async ({ locals: { getSession, supabase }, cookies }) => {
	const session = await getSession();
	const siteId = PUBLIC_SITE_ID || 'edda';

	// Get table configs for navbar and website
	const navbarConfig = EDDA_TABLE_CONFIGS.find((c) => c.table === 'website_navbar_links');
	const websiteConfig = EDDA_TABLE_CONFIGS.find((c) => c.table === 'websites');
	if (!navbarConfig || !websiteConfig) {
		return { session, cookies: cookies.getAll(), navbarLinks: [] as NavbarLink[], website: null };
	}

	// Load data using cache-first strategy
	const [navbarResult, websiteResult] = await Promise.all([
		loadWithCacheFirst<NavbarLink>(supabase, '.cache', siteId, navbarConfig),
		loadWithCacheFirst(supabase, '.cache', siteId, websiteConfig)
	]);

	return {
		session,
		cookies: cookies.getAll(),
		navbarLinks: navbarResult.data ?? ([] as NavbarLink[]),
		website: websiteResult.data?.[0] ?? null
	};
};
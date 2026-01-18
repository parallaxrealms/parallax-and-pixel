import type { LayoutServerLoad } from './$types';
import { PUBLIC_SITE_ID } from '$env/static/public';
import { loadWithCacheFirst, EDDA_TABLE_CONFIGS } from '@parallaxrealms/api-auth';
import type { NavbarLink, SiteOptions } from '@parallaxrealms/types-core';

export const load: LayoutServerLoad = async ({ locals: { getSession, supabase }, cookies }) => {
	const session = await getSession();
	const siteId = PUBLIC_SITE_ID || 'edda';

	// Get table configs for navbar and site options
	const navbarConfig = EDDA_TABLE_CONFIGS.find((c) => c.table === 'site_navbar_links')!;
	const siteOptionsConfig = EDDA_TABLE_CONFIGS.find((c) => c.table === 'site_options')!;

	// Load data using cache-first strategy
	const [navbarResult, siteOptionsResult] = await Promise.all([
		loadWithCacheFirst<NavbarLink>(supabase, '.cache', siteId, navbarConfig),
		loadWithCacheFirst<SiteOptions>(supabase, '.cache', siteId, siteOptionsConfig)
	]);

	return {
		session,
		cookies: cookies.getAll(),
		navbarLinks: navbarResult.data ?? [],
		siteOptions: siteOptionsResult.data?.[0] ?? null
	};
};
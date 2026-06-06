import type { RequestHandler } from './$types';

const SITE_URL = 'https://www.parallaxandpixel.com';

/** Escape XML special characters (for slugs and any dynamic values) */
function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

interface SitemapEntry {
	loc: string;
	lastmod: string;
	changefreq?: string;
	priority?: string;
}

function renderUrl(entry: SitemapEntry): string {
	return [
		'\t<url>',
		`\t\t<loc>${entry.loc}</loc>`,
		`\t\t<lastmod>${entry.lastmod}</lastmod>`,
		entry.changefreq ? `\t\t<changefreq>${entry.changefreq}</changefreq>` : '',
		entry.priority ? `\t\t<priority>${entry.priority}</priority>` : '',
		'\t</url>'
	]
		.filter(Boolean)
		.join('\n');
}

function renderSitemap(entries: SitemapEntry[]): string {
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...entries.map(renderUrl),
		'</urlset>'
	].join('\n');
}

export const GET: RequestHandler = async ({ locals }) => {
	const today = new Date().toISOString().split('T')[0];

	// Static routes
	const entries: SitemapEntry[] = [
		{ loc: `${SITE_URL}/`, lastmod: today, changefreq: 'weekly', priority: '1.0' },
		{ loc: `${SITE_URL}/blog`, lastmod: today, changefreq: 'weekly', priority: '0.9' },
		{ loc: `${SITE_URL}/web`, lastmod: today, changefreq: 'monthly', priority: '0.8' },
		{ loc: `${SITE_URL}/games`, lastmod: today, changefreq: 'monthly', priority: '0.8' }
	];

	try {
		// Mirrors the filters used by /blog/+page.server.ts and /(site)/[slug]/+page.server.ts:
		// the `pages` table, status = 'published', ordered by created_at desc.
		const { data: pages, error } = await locals.supabase
			.from('pages')
			.select('slug, created_at, updated_at, page_options')
			.eq('status', 'published')
			.order('created_at', { ascending: false });

		if (!error && pages) {
			type PageRow = {
				slug: string;
				created_at: string | null;
				updated_at: string | null;
				page_options: { page_type?: string } | null;
			};

			const blogPosts: SitemapEntry[] = [];
			const cmsPages: SitemapEntry[] = [];

			for (const page of pages as PageRow[]) {
				if (!page.slug) continue;
				const lastmodRaw = page.updated_at || page.created_at;
				const lastmod = lastmodRaw ? lastmodRaw.split('T')[0] : today;
				const slug = escapeXml(page.slug);

				// page_options.page_type = 'page' → CMS page at /{slug};
				// everything else is listed on /blog and rendered at /blog/{slug}
				if (page.page_options?.page_type === 'page') {
					cmsPages.push({
						loc: `${SITE_URL}/${slug}`,
						lastmod,
						priority: '0.6'
					});
				} else {
					blogPosts.push({
						loc: `${SITE_URL}/blog/${slug}`,
						lastmod,
						changefreq: 'monthly',
						priority: '0.7'
					});
				}
			}

			entries.push(...blogPosts, ...cmsPages);
		}
	} catch {
		// Supabase unavailable — fall through and serve the static-routes-only sitemap
	}

	return new Response(renderSitemap(entries), {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
};

/**
 * Findings generator — customer-facing, PXP only.
 *
 * `deriveFindings(signals)` turns the raw signals into plain-English
 * findings grouped by pillar. The checks mirror the same signal inputs the
 * gap functions read (`rubric/v1.ts`), so the findings explain WHY a pillar
 * scored the way it did.
 *
 * Voice (DESIGN.md): outcomes not jargon, no em dashes, no exclamation
 * points. Lead with what the customer gets, not the spec.
 */

import type { Finding, Signals } from './types';

// Google Core Web Vitals thresholds (mobile).
const LCP_GOOD_MS = 2500;
const LCP_POOR_MS = 4000;
const CLS_GOOD = 0.1;
const CLS_POOR = 0.25;
const TBT_GOOD_MS = 200;
const TBT_POOR_MS = 600;

export function deriveFindings(signals: Signals): Finding[] {
	const findings: Finding[] = [];
	const lh = signals.lighthouse;
	const ai = signals.ai_readiness;
	const content = signals.content;
	const stack = signals.stack;

	// ── Performance ────────────────────────────────────────────────
	if (lh) {
		if (lh.lcp_ms !== null && lh.lcp_ms > LCP_POOR_MS) {
			findings.push({
				pillar: 'performance',
				severity: 'critical',
				title: 'Your homepage takes too long to show its main content',
				description: `The biggest thing on screen takes ${secs(lh.lcp_ms)} to appear on a phone. More than half of mobile visitors leave a page that takes over 3 seconds.`,
				fix: 'Compress and resize your hero image, and serve it in a modern format like AVIF or WebP. Move large scripts to load after the page is visible.'
			});
		} else if (lh.lcp_ms !== null && lh.lcp_ms > LCP_GOOD_MS) {
			findings.push({
				pillar: 'performance',
				severity: 'warning',
				title: 'Main content could load a little faster',
				description: `Your biggest on-screen element takes ${secs(lh.lcp_ms)} to appear. Google considers under 2.5 seconds good.`,
				fix: 'Optimize your largest image and reduce render-blocking CSS so the page paints sooner.'
			});
		}

		if (lh.cls !== null && lh.cls > CLS_POOR) {
			findings.push({
				pillar: 'performance',
				severity: 'critical',
				title: 'Things jump around while your page loads',
				description: `Your layout shifts noticeably as the page loads (score ${lh.cls.toFixed(2)}). That makes people tap the wrong thing and feels broken.`,
				fix: 'Set explicit width and height on images and embeds, and reserve space for anything that loads in late, like ads or banners.'
			});
		} else if (lh.cls !== null && lh.cls > CLS_GOOD) {
			findings.push({
				pillar: 'performance',
				severity: 'warning',
				title: 'A little layout shift as the page loads',
				description: `Your page moves slightly as it loads (score ${lh.cls.toFixed(2)}). Under 0.1 is the target.`,
				fix: 'Reserve space for images and late-loading elements by setting their dimensions up front.'
			});
		}

		if (lh.tbt_ms !== null && lh.tbt_ms > TBT_POOR_MS) {
			findings.push({
				pillar: 'performance',
				severity: 'warning',
				title: 'Taps and clicks feel sluggish at first',
				description: `Heavy scripts block the page for ${Math.round(lh.tbt_ms)} milliseconds while it loads, so early taps feel unresponsive.`,
				fix: 'Defer non-essential scripts like analytics and chat widgets, and remove code you no longer use.'
			});
		} else if (lh.tbt_ms !== null && lh.tbt_ms > TBT_GOOD_MS) {
			findings.push({
				pillar: 'performance',
				severity: 'info',
				title: 'Some scripts delay interaction slightly',
				description: `Scripts block the page for ${Math.round(lh.tbt_ms)} milliseconds during load.`,
				fix: 'Defer third-party scripts so they load after the page is interactive.'
			});
		}

		if (lh.performance <= 49) {
			findings.push({
				pillar: 'performance',
				severity: 'critical',
				title: 'Overall speed needs serious work',
				description: `Your performance score is ${lh.performance} out of 100. On a typical phone and network, the site feels slow.`,
				fix: 'Start with the largest image and the heaviest third-party scripts, then enable caching and a content delivery network.'
			});
		}

		if (stack.has_jquery) {
			findings.push({
				pillar: 'performance',
				severity: 'info',
				title: 'Your site still loads an older JavaScript library',
				description:
					'jQuery is on the page. Modern browsers do most of what it offered natively, and it adds weight every visitor downloads.',
				fix: 'Where practical, replace jQuery usage with native browser features to shave load time.'
			});
		}
	} else {
		findings.push({
			pillar: 'performance',
			severity: 'info',
			title: 'We could not measure page speed this time',
			description:
				'The performance test did not complete, so the performance score is an estimate. This usually clears up on a re-run.',
			fix: 'Run the audit again in a few minutes to capture a full speed measurement.'
		});
	}

	// ── AI-Readiness ───────────────────────────────────────────────
	if (!ai.llms_txt) {
		findings.push({
			pillar: 'ai_readiness',
			severity: 'warning',
			title: 'No llms.txt file',
			description:
				'AI assistants increasingly look for an llms.txt file to learn how to read and cite your site. Yours does not have one.',
			fix: 'Add an llms.txt at the root of your site so AI agents know how to read and cite your content.'
		});
	}
	if (!ai.has_schema_ld) {
		findings.push({
			pillar: 'ai_readiness',
			severity: 'warning',
			title: 'No structured data for search and AI',
			description:
				'Your pages have no Schema.org markup. This is the structured data that lets Google and AI tools understand what your business is and show it in rich results.',
			fix: 'Add Schema.org JSON-LD for your organization and, if you are a local business, LocalBusiness with your address and hours.'
		});
	}
	if (!ai.has_opengraph) {
		findings.push({
			pillar: 'ai_readiness',
			severity: 'warning',
			title: 'Links to your site look plain when shared',
			description:
				'Open Graph tags are missing, so when someone shares your page on social or chat apps there is no title, description, or preview image.',
			fix: 'Add Open Graph meta tags with a title, description, and a share image so links preview nicely.'
		});
	}
	if (!ai.has_twitter_card) {
		findings.push({
			pillar: 'ai_readiness',
			severity: 'info',
			title: 'No Twitter / X card markup',
			description:
				'Twitter Card tags are missing, so shares on X fall back to a plain link with no large preview.',
			fix: 'Add a twitter:card meta tag (summary_large_image) alongside your Open Graph tags.'
		});
	}
	if (ai.semantic_html_ratio < 0.4) {
		findings.push({
			pillar: 'ai_readiness',
			severity: 'warning',
			title: 'Your page structure is hard for machines to read',
			description:
				'Most of your page is generic containers rather than meaningful sections like header, nav, main, and footer. Search engines and AI tools rely on that structure to understand your content.',
			fix: 'Use semantic HTML landmarks (header, nav, main, article, section, footer) instead of plain div elements where they fit.'
		});
	}
	if (!ai.html_lang) {
		findings.push({
			pillar: 'ai_readiness',
			severity: 'info',
			title: 'Your page does not declare its language',
			description:
				'The html tag has no lang attribute. This helps screen readers and translation tools handle your content correctly.',
			fix: 'Add a lang attribute to your html element, for example lang="en".'
		});
	}

	// ── SEO ────────────────────────────────────────────────────────
	if (!ai.sitemap_xml) {
		findings.push({
			pillar: 'seo',
			severity: 'warning',
			title: 'No sitemap.xml',
			description:
				'Search engines use a sitemap to discover every page on your site. Yours was not found at /sitemap.xml.',
			fix: 'Publish a sitemap.xml listing your pages and reference it from robots.txt.'
		});
	}
	if (!ai.robots_txt) {
		findings.push({
			pillar: 'seo',
			severity: 'info',
			title: 'No robots.txt',
			description:
				'A robots.txt tells search engines and AI crawlers what they can access. Yours was not found.',
			fix: 'Add a robots.txt at your site root, even a simple one that allows everything and points to your sitemap.'
		});
	}
	if (!ai.has_canonical) {
		findings.push({
			pillar: 'seo',
			severity: 'warning',
			title: 'No canonical tag',
			description:
				'Without a canonical tag, search engines can get confused when the same page is reachable at more than one address, splitting your ranking signals.',
			fix: 'Add a self-referencing canonical link tag to each page.'
		});
	}
	if (content.description_length === 0) {
		findings.push({
			pillar: 'seo',
			severity: 'warning',
			title: 'Missing meta description',
			description:
				'Your homepage has no meta description, so Google writes its own snippet for your search result, which is often less compelling than one you control.',
			fix: 'Write a clear 150 to 160 character meta description that summarizes the page and invites a click.'
		});
	}
	if (content.title_length === 0) {
		findings.push({
			pillar: 'seo',
			severity: 'critical',
			title: 'Missing page title',
			description:
				'Your homepage has no title tag. The title is the single most important on-page SEO element and the headline of your search result.',
			fix: 'Add a descriptive title tag, ideally including your business name and what you do.'
		});
	} else if (content.title_length > 70) {
		findings.push({
			pillar: 'seo',
			severity: 'info',
			title: 'Your page title is long enough to get cut off',
			description: `Your title is ${content.title_length} characters. Google typically shows about 60, so the end may be truncated in search results.`,
			fix: 'Trim the title to roughly 60 characters with the most important words first.'
		});
	}
	if (lh && lh.seo <= 89 && lh.seo > 0) {
		findings.push({
			pillar: 'seo',
			severity: 'info',
			title: 'A few smaller SEO items to tighten up',
			description: `Your technical SEO score is ${lh.seo} out of 100. The basics are mostly there, with room to polish.`,
			fix: 'Review link text, image alt attributes, and mobile tap target sizes for quick wins.'
		});
	}

	return findings;
}

function secs(ms: number): string {
	return `${(ms / 1000).toFixed(1)} seconds`;
}

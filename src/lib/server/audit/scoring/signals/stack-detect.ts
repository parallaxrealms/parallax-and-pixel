/**
 * Stack fingerprinting from raw HTML. Ported VERBATIM from 9realms'
 * `scoring/signals/stack-detect.ts` for signal parity. Regex-based; good
 * enough for the common CMSes and frameworks we target.
 *
 * Detection order matters: more-specific CMSes (Shopify, Webflow) before
 * generic signals. First match wins for `cms`.
 */

import type { CmsName, StackSignals } from '../types';

interface CmsPattern {
	name: CmsName;
	patterns: RegExp[];
	versionPattern?: RegExp;
}

const CMS_PATTERNS: CmsPattern[] = [
	{
		name: 'wordpress',
		patterns: [
			/<meta[^>]+name=["']generator["'][^>]+WordPress/i,
			/\/wp-content\//i,
			/\/wp-includes\//i,
			/wp-json\//i
		],
		versionPattern: /WordPress\s+(\d+\.\d+(?:\.\d+)?)/i
	},
	{
		name: 'shopify',
		patterns: [/cdn\.shopify\.com/i, /Shopify\.theme/i, /\/shopify_pay\//i]
	},
	{
		name: 'squarespace',
		patterns: [
			/squarespace-cdn\.com/i,
			/static1\.squarespace\.com/i,
			/<meta[^>]+content=["']Squarespace["']/i
		]
	},
	{
		name: 'wix',
		patterns: [/static\.wixstatic\.com/i, /wix\.com\/_partials\//i, /_wix_/i]
	},
	{
		name: 'webflow',
		patterns: [/webflow\.com\/js/i, /<html[^>]+data-wf-site=/i, /webflow\.css/i]
	},
	{
		name: 'drupal',
		patterns: [
			/<meta[^>]+name=["']Generator["'][^>]+Drupal/i,
			/\/sites\/default\/files\//i,
			/drupal-ajax/i
		],
		versionPattern: /Drupal\s+(\d+)/i
	},
	{
		name: 'joomla',
		patterns: [/<meta[^>]+name=["']generator["'][^>]+Joomla/i, /\/media\/jui\//i],
		versionPattern: /Joomla!?\s+(\d+\.\d+)/i
	},
	{
		name: 'ghost',
		patterns: [/<meta[^>]+name=["']generator["'][^>]+Ghost/i, /ghost\.io/i],
		versionPattern: /Ghost\s+(\d+\.\d+)/i
	},
	{
		name: 'hubspot',
		patterns: [/hs-scripts\.com/i, /hubspotstatic\.com/i, /\.hubspot\./i]
	},
	{
		name: 'duda',
		patterns: [/dudastatic\.com/i, /window\.dmAPI/i]
	},
	{
		name: 'weebly',
		patterns: [/weebly\.com\/editor/i, /cdn2\.editmysite\.com/i]
	}
];

const JQUERY_PATTERNS = [
	/jquery[.-](\d+\.\d+\.\d+)(?:\.min)?\.js/i,
	/\/jquery\/(\d+\.\d+\.\d+)\//i
];

const REACT_PATTERNS = [/\breact\.(?:production|development)\.min\.js\b/i, /<[^>]+data-reactroot/i];
const VUE_PATTERNS = [/\bvue(?:\.min)?\.js\b/i, /__vue_app__/i];
const SVELTE_PATTERNS = [/\bsvelte[-.]/i, /__svelte_meta/i];
const ANGULAR_PATTERNS = [/\bng-version=/i, /angular(?:\.min)?\.js/i];

const CDN_PATTERNS: Array<[string, RegExp]> = [
	['cloudflare', /cloudflare|cdnjs\.cloudflare\.com/i],
	['fastly', /fastly\.net/i],
	['akamai', /akamaized\.net|akamaihd\.net/i],
	['cloudfront', /cloudfront\.net/i],
	['netlify', /netlify\.app|netlify\.com/i],
	['vercel', /vercel\.app|vercel-insights/i]
];

export function detectStack(html: string): StackSignals {
	const result: StackSignals = {
		cms: null,
		cms_version: null,
		has_jquery: false,
		jquery_version: null,
		has_react: false,
		has_vue: false,
		has_svelte: false,
		has_angular: false,
		has_viewport_meta: /<meta[^>]+name=["']viewport["']/i.test(html),
		has_cdn: false,
		cdn_provider: null,
		detected_tech: []
	};

	// CMS — first match wins
	for (const pat of CMS_PATTERNS) {
		if (pat.patterns.some((re) => re.test(html))) {
			result.cms = pat.name;
			if (pat.versionPattern) {
				const m = html.match(pat.versionPattern);
				if (m?.[1]) result.cms_version = m[1];
			}
			result.detected_tech.push(pat.name);
			break;
		}
	}

	// Frameworks (not exclusive — a WP site can use React for one widget)
	for (const re of JQUERY_PATTERNS) {
		const m = html.match(re);
		if (m) {
			result.has_jquery = true;
			result.jquery_version = m[1] ?? null;
			result.detected_tech.push('jquery');
			break;
		}
	}
	if (!result.has_jquery && /\bjquery\b/i.test(html)) {
		// Unversioned jQuery reference
		result.has_jquery = true;
		result.detected_tech.push('jquery');
	}

	if (REACT_PATTERNS.some((re) => re.test(html))) {
		result.has_react = true;
		result.detected_tech.push('react');
	}
	if (VUE_PATTERNS.some((re) => re.test(html))) {
		result.has_vue = true;
		result.detected_tech.push('vue');
	}
	if (SVELTE_PATTERNS.some((re) => re.test(html))) {
		result.has_svelte = true;
		result.detected_tech.push('svelte');
	}
	if (ANGULAR_PATTERNS.some((re) => re.test(html))) {
		result.has_angular = true;
		result.detected_tech.push('angular');
	}

	// CDN — first match wins
	for (const [name, re] of CDN_PATTERNS) {
		if (re.test(html)) {
			result.has_cdn = true;
			result.cdn_provider = name;
			result.detected_tech.push(`cdn:${name}`);
			break;
		}
	}

	return result;
}

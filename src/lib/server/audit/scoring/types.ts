/**
 * Audit scoring pipeline types.
 *
 * The signal shapes are ported VERBATIM from 9realms'
 * `src/lib/server/prospectallax/scoring/types.ts` so the same URL produces
 * the same raw measurements in both systems (signal parity). The customer
 * never sees these — they feed the quality rubric in `quality.ts`.
 *
 * Additive only — if you add a field, new scoring runs get it; historical
 * scores simply don't. Never rename; bump rubric_version instead.
 */

export interface LighthouseSignals {
	performance: number; // 0-100
	seo: number;
	accessibility: number;
	best_practices: number;
	/** Largest Contentful Paint (milliseconds). */
	lcp_ms: number | null;
	/** Cumulative Layout Shift. */
	cls: number | null;
	/** Total Blocking Time (milliseconds). */
	tbt_ms: number | null;
	/** First Contentful Paint (milliseconds). */
	fcp_ms: number | null;
	/** Speed Index (milliseconds). */
	si_ms: number | null;
	/** Strategy used for the run. */
	strategy: 'mobile' | 'desktop';
	/** Which audit path produced these numbers — PSI or local Lighthouse. */
	source?: 'psi' | 'local';
	fetched_at: string;
}

export type CmsName =
	| 'wordpress'
	| 'squarespace'
	| 'wix'
	| 'webflow'
	| 'shopify'
	| 'drupal'
	| 'joomla'
	| 'ghost'
	| 'hubspot'
	| 'duda'
	| 'weebly'
	| 'custom';

export interface StackSignals {
	cms: CmsName | null;
	cms_version: string | null;
	has_jquery: boolean;
	jquery_version: string | null;
	has_react: boolean;
	has_vue: boolean;
	has_svelte: boolean;
	has_angular: boolean;
	has_viewport_meta: boolean;
	has_cdn: boolean;
	cdn_provider: string | null;
	/** All detected technologies for display; not used in scoring. */
	detected_tech: string[];
}

export interface AiReadinessSignals {
	llms_txt: boolean;
	robots_txt: boolean;
	sitemap_xml: boolean;
	has_schema_ld: boolean;
	schema_types: string[];
	has_opengraph: boolean;
	has_twitter_card: boolean;
	has_canonical: boolean;
	/** Landmarks + semantic tags / total elements. 0.0 – 1.0. */
	semantic_html_ratio: number;
	html_lang: string | null;
}

export interface ContentSignals {
	word_count: number;
	has_blog: boolean;
	copyright_year: number | null;
	title_length: number;
	description_length: number;
}

export interface TlsSignals {
	valid: boolean;
	issuer: string | null;
	expires_at: string | null;
	days_until_expiry: number | null;
}

export interface Signals {
	url: string;
	/** PSI mobile strategy — canonical for rubric + Core Web Vitals. */
	lighthouse: LighthouseSignals | null;
	/** PSI desktop strategy — optional, diagnostic only. */
	lighthouse_desktop?: LighthouseSignals | null;
	stack: StackSignals;
	ai_readiness: AiReadinessSignals;
	content: ContentSignals;
	tls: TlsSignals;
	/** sha256 of normalized homepage markdown for change-detection. */
	content_hash?: string;
	gathered_at: string;
	/** Any errors encountered while gathering; surfaced for debugging. */
	errors: string[];
}

/** Severity band shared by findings + verdict labels. */
export type FindingSeverity = 'critical' | 'warning' | 'info';
export type Pillar = 'performance' | 'ai_readiness' | 'seo';

export interface Finding {
	pillar: Pillar;
	severity: FindingSeverity;
	title: string;
	description: string;
	fix: string;
}

/**
 * Customer-facing pillar quality scores. 0-100, higher = better. Derived
 * from the SAME gap functions 9realms uses, inverted + reweighted. This is
 * the ONLY scoring object the customer ever sees — it deliberately omits
 * the internal opportunity-gap / recommended-package concepts.
 */
export interface QualityResult {
	overall: number;
	performance: number;
	ai_readiness: number;
	seo: number;
	rubric_version: 'quality-v1';
}

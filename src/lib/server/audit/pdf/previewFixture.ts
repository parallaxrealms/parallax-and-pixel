/**
 * Dev-only fixture for eyeballing the audit PDF report template without a real
 * audit row or render token. Used by the report loader when `?preview=1` is
 * passed AND `dev` is true (see +page.server.ts). Never reachable in prod.
 *
 * The signal values are hand-picked to exercise every visual state: a poor LCP
 * (red marker), good TBT/CLS (green), a mix of pass/warn/fail checklist rows,
 * and findings across all three pillars.
 */

import type { QualityResult, Signals } from '../scoring/types';
import { deriveFindings } from '../scoring/findings';
import { buildReportModel, type ReportModel } from './model';

const FIXTURE_SCORES: QualityResult = {
	overall: 72,
	performance: 64,
	ai_readiness: 81,
	seo: 70,
	rubric_version: 'quality-v1'
};

const FIXTURE_SIGNALS: Signals = {
	url: 'https://acmebakery.com',
	lighthouse: {
		performance: 64,
		seo: 70,
		accessibility: 90,
		best_practices: 92,
		lcp_ms: 4100,
		cls: 0.07,
		tbt_ms: 180,
		fcp_ms: 1600,
		si_ms: 3200,
		strategy: 'mobile',
		source: 'psi',
		fetched_at: '2026-05-26T14:22:11.000Z'
	},
	stack: {
		cms: 'wordpress',
		cms_version: null,
		has_jquery: true,
		jquery_version: '3.6.0',
		has_react: false,
		has_vue: false,
		has_svelte: false,
		has_angular: false,
		has_viewport_meta: true,
		has_cdn: true,
		cdn_provider: 'Cloudflare',
		detected_tech: ['WordPress', 'jQuery', 'Cloudflare']
	},
	ai_readiness: {
		llms_txt: false,
		robots_txt: true,
		sitemap_xml: false,
		has_schema_ld: true,
		schema_types: ['Organization', 'LocalBusiness'],
		has_opengraph: true,
		has_twitter_card: false,
		has_canonical: true,
		semantic_html_ratio: 0.18,
		html_lang: 'en'
	},
	content: {
		word_count: 850,
		has_blog: true,
		copyright_year: 2026,
		title_length: 52,
		description_length: 95
	},
	tls: {
		valid: true,
		issuer: "Let's Encrypt",
		expires_at: '2026-08-04T00:00:00.000Z',
		days_until_expiry: 70
	},
	gathered_at: '2026-05-26T14:22:11.000Z',
	errors: []
};

export function buildPreviewModel(): ReportModel {
	return buildReportModel({
		auditId: 'preview0-0000-0000-0000-000000000000',
		url: FIXTURE_SIGNALS.url,
		scores: FIXTURE_SCORES,
		signals: FIXTURE_SIGNALS,
		findings: deriveFindings(FIXTURE_SIGNALS),
		createdAt: '2026-05-26T14:22:11.000Z'
	});
}

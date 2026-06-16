/**
 * Gap functions ported from 9realms' `scoring/rubric/v1.ts`.
 *
 * ONLY the three customer-relevant gap functions are ported:
 * `performanceGap`, `seoGap`, `aiReadinessGap` — VERBATIM, so PXP and
 * 9realms compute the same intermediate gap from the same signals.
 *
 * The 9realms-only sales-prospecting functions (`designStaleness`,
 * `firmographicFit`, `maintenanceSignal`, `recommendPackage`,
 * `computeScore`) are DELIBERATELY NOT ported — those are internal
 * opportunity-prospecting concepts the customer must never see. The
 * customer-facing inversion lives in `../quality.ts`.
 *
 * Never modify this file to "tune" the gaps. The gap math is shared parity
 * with 9realms; create a v2 instead.
 */

import type { AiReadinessSignals, LighthouseSignals, Signals } from '../types';

/** Performance opportunity — inverse of Lighthouse Performance score. */
export function performanceGap(lh: LighthouseSignals | null): number {
	if (!lh) return 50; // unknown => assume mid-risk
	if (lh.performance > 85) return 0; // too good to pitch a rebuild
	return clamp(100 - lh.performance);
}

/** SEO opportunity — inverse of Lighthouse SEO + structural penalties. */
export function seoGap(s: Signals): number {
	const lh = s.lighthouse;
	let gap = lh ? 100 - lh.seo : 50;
	const ai = s.ai_readiness;
	if (!ai.robots_txt) gap += 5;
	if (!ai.sitemap_xml) gap += 10;
	if (!ai.has_canonical) gap += 5;
	if (s.content.description_length === 0) gap += 10;
	if (s.content.title_length === 0 || s.content.title_length > 70) gap += 5;
	return clamp(gap);
}

/** AI-readiness opportunity. */
export function aiReadinessGap(ai: AiReadinessSignals): number {
	let gap = 0;
	if (!ai.llms_txt) gap += 20;
	if (!ai.has_schema_ld) gap += 20;
	if (!ai.has_opengraph) gap += 10;
	if (!ai.sitemap_xml) gap += 10;
	if (ai.semantic_html_ratio < 0.4) gap += 15;
	if (!ai.robots_txt) gap += 5;
	if (!ai.has_canonical) gap += 5;
	if (!ai.has_twitter_card) gap += 5;
	if (!ai.html_lang) gap += 5;
	return clamp(gap);
}

export function clamp(v: number, min = 0, max = 100): number {
	return Math.max(min, Math.min(max, v));
}

/**
 * Customer-facing QUALITY rubric — PXP only. quality-v1.
 *
 * Three pillar quality scores, 0-100, higher = better. Derived from the
 * SAME gap functions 9realms uses (`rubric/v1.ts`), but INVERTED + reweighted
 * for a customer who wants to know "how good is my site" rather than "how
 * big is the sales opportunity."
 *
 * Pure function — no I/O, no side effects.
 *
 * Perf special-case: 9realms' performanceGap() caps at 0 for perf>85 (a
 * sales heuristic — "too good to pitch a rebuild"). For a customer quality
 * score we want the RAW Lighthouse performance so a 95 reads as 95, not 100.
 * So perfQuality reads lighthouse.performance directly and does NOT go
 * through performanceGap. SEO + AI quality DO invert their gap functions.
 */

import type { QualityResult, Signals } from './types';
import { seoGap, aiReadinessGap, clamp } from './rubric/v1';

export function computeQuality(signals: Signals): QualityResult {
	// Perf: raw Lighthouse performance (NOT inverted gap). Unknown => 50.
	const perfQuality = signals.lighthouse ? clamp(signals.lighthouse.performance) : 50;
	const seoQuality = clamp(100 - seoGap(signals));
	const aiQuality = clamp(100 - aiReadinessGap(signals.ai_readiness));

	const overall = Math.round(0.4 * perfQuality + 0.3 * aiQuality + 0.3 * seoQuality);

	return {
		overall,
		performance: Math.round(perfQuality),
		ai_readiness: Math.round(aiQuality),
		seo: Math.round(seoQuality),
		rubric_version: 'quality-v1'
	};
}

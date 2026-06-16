/**
 * Google PageSpeed Insights API integration.
 *
 * Ported from 9realms' `scoring/signals/lighthouse.ts`. The request +
 * retry + extract core is VERBATIM (so the same URL yields the same raw
 * Lighthouse numbers in both systems). The DB-backed cache + usage-log
 * layer is removed — PXP scores a unique URL once per audit and has no
 * `prospect_signals_cache` / `prospect_usage_log` tables.
 *
 * Runs an authoritative Lighthouse audit. Free without a key for low
 * volume; PAGESPEED_API_KEY bumps quota to 25k/day. We call mobile
 * strategy as the canonical run (matches how most traffic arrives).
 */

import { env } from '$env/dynamic/private';
import type { LighthouseSignals } from '../types';

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
// PSI's mobile strategy re-emulates the full Lighthouse run server-side.
// 90-110s is routine on JS-heavy sites; 180s gives real headroom.
const TIMEOUT_MS = 180_000;

export async function runLighthouse(
	url: string,
	opts: { strategy?: 'mobile' | 'desktop' } = {}
): Promise<{ signals: LighthouseSignals | null; error: string | null }> {
	const strategy = opts.strategy ?? 'mobile';
	// PSI's backend regularly returns HTTP 500 or times out on the first
	// request and succeeds on a second try ~10s later. Retry once on these
	// specific transient outcomes. 4xx responses are not retried.
	const TRANSIENT_RETRY_DELAY_MS = 10_000;

	const params = new URLSearchParams();
	params.append('url', url);
	params.append('strategy', strategy);
	for (const cat of ['performance', 'seo', 'accessibility', 'best-practices']) {
		params.append('category', cat);
	}
	const apiKey = env.PAGESPEED_API_KEY;
	if (apiKey) params.append('key', apiKey);
	const endpointUrl = `${ENDPOINT}?${params.toString()}`;

	let lastError: string | null = null;

	for (let attempt = 1; attempt <= 2; attempt++) {
		const controller = new AbortController();
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, TIMEOUT_MS);
		try {
			const r = await fetch(endpointUrl, {
				signal: controller.signal,
				headers: { 'User-Agent': 'PxpAudit/0.1' }
			});
			if (!r.ok) {
				const msg = `pagespeed HTTP ${r.status}`;
				// 5xx is transient (Google's backend hiccup). 4xx is not.
				const transient = r.status >= 500 && r.status < 600;
				lastError = msg;
				if (!transient || attempt === 2) {
					return { signals: null, error: msg };
				}
				await new Promise((res) => setTimeout(res, TRANSIENT_RETRY_DELAY_MS));
				continue;
			}
			const json = (await r.json()) as PageSpeedResponse;
			const signals = extractSignals(json, strategy);
			return { signals, error: null };
		} catch (e) {
			const rawMsg = e instanceof Error ? e.message : 'lighthouse failed';
			const msg = timedOut ? `pagespeed timeout after ${TIMEOUT_MS / 1000}s` : rawMsg;
			lastError = msg;
			// Timeouts on attempt 1 are worth a retry.
			if (attempt === 2) {
				return { signals: null, error: msg };
			}
			await new Promise((res) => setTimeout(res, TRANSIENT_RETRY_DELAY_MS));
		} finally {
			clearTimeout(timer);
		}
	}

	// Unreachable — the second attempt always returns. Guard for TS.
	return { signals: null, error: lastError ?? 'lighthouse: unknown failure' };
}

interface PageSpeedResponse {
	lighthouseResult?: {
		categories?: {
			performance?: { score?: number };
			seo?: { score?: number };
			accessibility?: { score?: number };
			'best-practices'?: { score?: number };
		};
		audits?: {
			'largest-contentful-paint'?: { numericValue?: number };
			'cumulative-layout-shift'?: { numericValue?: number };
			'total-blocking-time'?: { numericValue?: number };
			'first-contentful-paint'?: { numericValue?: number };
			'speed-index'?: { numericValue?: number };
		};
	};
}

function extractSignals(json: PageSpeedResponse, strategy: 'mobile' | 'desktop'): LighthouseSignals {
	const cats = json.lighthouseResult?.categories;
	const audits = json.lighthouseResult?.audits;
	const scoreTo100 = (v: number | undefined) => (v !== undefined ? Math.round(v * 100) : 0);
	return {
		performance: scoreTo100(cats?.performance?.score),
		seo: scoreTo100(cats?.seo?.score),
		accessibility: scoreTo100(cats?.accessibility?.score),
		best_practices: scoreTo100(cats?.['best-practices']?.score),
		lcp_ms: audits?.['largest-contentful-paint']?.numericValue ?? null,
		cls: audits?.['cumulative-layout-shift']?.numericValue ?? null,
		tbt_ms: audits?.['total-blocking-time']?.numericValue ?? null,
		fcp_ms: audits?.['first-contentful-paint']?.numericValue ?? null,
		si_ms: audits?.['speed-index']?.numericValue ?? null,
		strategy,
		source: 'psi',
		fetched_at: new Date().toISOString()
	};
}

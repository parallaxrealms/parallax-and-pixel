/**
 * Minimal Firecrawl client for the audit engine.
 *
 * Ported (trimmed) from 9realms' `$lib/server/firecrawl.ts` so the audit
 * signal layer (`scoring/signals/firecrawl-signals.ts`) consumes the same
 * `ScrapeResult` shape and produces the same HTML-derived signals as
 * 9realms. We deliberately drop 9realms' DB-backed cache + usage-log layer:
 * PXP has no `prospect_signals_cache` / `prospect_usage_log` tables, and
 * each audit scrapes a unique URL once, so the cache earns its keep there
 * but not here.
 *
 * Firecrawl scrapes via a headless browser, so we get the JS-rendered DOM —
 * the same fidelity 9realms relies on. When FIRECRAWL_API_KEY is absent the
 * engine falls back to a plain server-side fetch (no JS render); see
 * `firecrawl-signals.ts`.
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import { env } from '$env/dynamic/private';

let _client: FirecrawlApp | null = null;

export function hasFirecrawl(): boolean {
	return Boolean(env.FIRECRAWL_API_KEY);
}

export function getFirecrawl(): FirecrawlApp {
	if (_client) return _client;
	const apiKey = env.FIRECRAWL_API_KEY;
	if (!apiKey) throw new Error('FIRECRAWL_API_KEY not configured');
	_client = new FirecrawlApp({ apiKey });
	return _client;
}

export interface ScrapeResult {
	url: string;
	markdown: string;
	html?: string;
	/**
	 * Raw, unmodified HTML as served by the origin (pre-cleanup). Preserves
	 * `<head>` contents like viewport meta + JSON-LD that Firecrawl's `html`
	 * cleanup may strip. Populated only when `rawHtml: true` is passed.
	 */
	rawHtml?: string;
	metadata: Record<string, unknown>;
	fromCache: boolean;
}

/**
 * Firecrawl action shape (subset we use). Kept for surface-parity with
 * 9realms even though the audit engine does not currently drive actions.
 */
export type FirecrawlAction =
	| { type: 'wait'; milliseconds?: number; selector?: string }
	| { type: 'click'; selector: string; all?: boolean }
	| { type: 'scroll'; direction: 'up' | 'down'; selector?: string }
	| { type: 'scrape' }
	| { type: 'executeJavascript'; script: string };

/**
 * Scrape a page via Firecrawl. Mirrors 9realms' `scrapeWithCache` signature
 * (minus the `UsageContext` arg — PXP has no usage log) so the signal
 * layer ports cleanly. Returns null on failure.
 */
export async function scrapeWithCache(
	url: string,
	opts: {
		html?: boolean;
		rawHtml?: boolean;
		waitFor?: number;
		actions?: FirecrawlAction[];
	} = {}
): Promise<ScrapeResult | null> {
	const formats: Array<'markdown' | 'html' | 'rawHtml'> = ['markdown'];
	if (opts.html) formats.push('html');
	if (opts.rawHtml) formats.push('rawHtml');

	try {
		const scrapeOpts: {
			formats: typeof formats;
			waitFor?: number;
			actions?: FirecrawlAction[];
		} = { formats };
		if (opts.waitFor) scrapeOpts.waitFor = opts.waitFor;
		if (opts.actions && opts.actions.length > 0) scrapeOpts.actions = opts.actions;

		// v2 API: .scrape() returns a Document directly (or throws on error).
		const doc = (await getFirecrawl().scrape(url, scrapeOpts)) as {
			markdown?: string;
			html?: string;
			rawHtml?: string;
			metadata?: Record<string, unknown>;
		};
		return {
			url,
			markdown: doc.markdown ?? '',
			html: doc.html,
			rawHtml: doc.rawHtml,
			metadata: doc.metadata ?? {},
			fromCache: false
		};
	} catch {
		return null;
	}
}

export function makeSessionId(): string {
	return new Date().toISOString().replace(/[:.]/g, '-');
}

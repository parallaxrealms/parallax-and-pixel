/**
 * Signals derived from a scrape of the homepage.
 *
 * Ported from 9realms' `scoring/signals/firecrawl-signals.ts`. The
 * extraction helpers (`extractAiReadiness`, `extractSchemaLdTypes`,
 * `computeSemanticRatio`, `extractContent`, etc.) are VERBATIM so the same
 * HTML produces the same AI/SEO/stack/content signals as 9realms.
 *
 * Two acquisition paths:
 *   1. Firecrawl (primary) — headless-browser scrape, JS-rendered DOM. This
 *      matches 9realms exactly. Includes the age-gate bypass retry.
 *   2. fetch + cheerio (fallback) — used only when FIRECRAWL_API_KEY is
 *      absent. Plain server-side fetch, NO JS render, so client-rendered
 *      SPAs will read thin. Acceptable for v1; flagged as a divergence.
 *
 * Markdown gives us: word count, copyright year, human text signals.
 * HTML gives us: stack detection, meta tags, schema.org JSON-LD, semantic
 *                HTML ratio, viewport, OG/Twitter cards.
 */

import * as cheerio from 'cheerio';
import {
	scrapeWithCache,
	hasFirecrawl,
	type ScrapeResult,
	type FirecrawlAction
} from '$lib/server/firecrawl';
import type { AiReadinessSignals, ContentSignals, Signals, StackSignals } from '../types';
import { detectStack } from './stack-detect';

/**
 * Heuristics for "the scraper landed on an age gate instead of the real
 * page." Breweries, bars, cannabis, vape sites gate the homepage behind a
 * "Yes I'm 21 / Enter Site" interstitial. We detect via short markdown +
 * age-verification phrasing.
 */
const AGE_GATE_PATTERN =
	/age[-\s]*verif|are you\s+(?:18|21|of\s+legal)|confirm\s+your\s+age|must be\s+(?:18|21)|over\s+21|enter\s+site|yes,?\s+i['\s]?m\s+(?:18|21)/i;

function looksLikeAgeGate(markdown: string, html: string, metaTitle?: string): boolean {
	const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length;
	if (wordCount >= 300) return false; // real content — even if "age" appears
	if (metaTitle && !AGE_GATE_PATTERN.test(metaTitle)) return false;
	const haystack = `${metaTitle ?? ''}\n${markdown}\n${html.slice(0, 4000)}`;
	return AGE_GATE_PATTERN.test(haystack);
}

function bypassRevealedContent(bypassMarkdown: string, bypassMetaTitle?: string): boolean {
	if (bypassMarkdown.trim().length < 200) return false;
	const titleOk = bypassMetaTitle ? !AGE_GATE_PATTERN.test(bypassMetaTitle) : false;
	const markdownOk = !AGE_GATE_PATTERN.test(bypassMarkdown);
	return titleOk || markdownOk;
}

const AGE_GATE_BYPASS_SCRIPT = `
(() => {
  const notes = [];
  try {
    const tokens = ['ageVerified','age_verified','is_of_age','ageGateVerified','age_gate_verified','verified_age','isAdult','ageCheck'];
    for (const k of tokens) {
      localStorage.setItem(k, 'true');
      sessionStorage.setItem(k, 'true');
      document.cookie = k + '=true;path=/;max-age=86400';
    }
    document.cookie = 'wp-postpass_age=1;path=/;max-age=86400';
    document.cookie = 'of_age=1;path=/;max-age=86400';
    notes.push('tokens-set');
  } catch (e) { notes.push('tokens-err:' + e.message); }

  const SELECTORS = [
    'button[data-submit="yes"]',
    '.age-gate-submit-yes',
    'button.age-gate-submit[value="1"]',
    '.age-verify-yes, .age-yes, .ageconfirm-yes',
    '.btn-age-yes, .btn-confirm-age',
    '[data-age-verify="yes"]',
    '[data-cy="age-gate-yes"]',
    'button[name*="age"][value="1"]',
    'input[type="submit"][value*="yes" i], input[type="submit"][value*="enter" i]'
  ];
  try {
    for (const sel of SELECTORS) {
      const el = document.querySelector(sel);
      if (el) { el.click(); notes.push('sel-click:' + sel); break; }
    }
  } catch (e) { notes.push('sel-err:' + e.message); }

  try {
    const els = Array.from(document.querySelectorAll(
      'button, a, input[type="submit"], input[type="button"], [role="button"], label'
    ));
    const affirm = els.find((el) => {
      const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('value') || '').trim();
      return /^(yes|yeah|yep|yup|sure|i\\s+sure|i\\s+am|i['\\s]?m\\s+(?:18|21|of|old)|over\\s+(?:18|21)|enter|confirm|continue|proceed|agree|submit|accept|verify)/i.test(text);
    });
    if (affirm) { affirm.click(); notes.push('txt-click:' + (affirm.textContent||'').slice(0,30)); }
  } catch (e) { notes.push('txt-err:' + e.message); }

  try {
    const form = document.querySelector('form.age-gate-form, form[class*="age-gate"], form[class*="age_gate"], form[id*="age"]');
    if (form) {
      const confirmField = form.querySelector('input[name="age_gate[confirm]"], [name*="confirm"]');
      if (confirmField) confirmField.value = '1';
      form.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = true; });
      form.submit();
      notes.push('form-submit:age-gate');
    } else {
      const forms = Array.from(document.querySelectorAll('form'));
      for (const f of forms) {
        const html = (f.outerHTML || '').toLowerCase();
        if (/age|verify|over.(18|21)/i.test(html)) {
          f.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = true; });
          f.submit();
          notes.push('form-submit:generic');
          break;
        }
      }
    }
  } catch (e) { notes.push('form-err:' + e.message); }

  try {
    document.querySelectorAll('[class*="age"],[id*="age"],[class*="verify"],[id*="verify"]').forEach((el) => {
      const sig = ((el.className || '') + ' ' + (el.id || '')).toString().toLowerCase();
      if (/gate|modal|overlay|popup|verify|check/.test(sig)) el.remove();
    });
  } catch {}

  return notes.join(' | ');
})();
`;

const AGE_GATE_BYPASS_ACTIONS: FirecrawlAction[] = [
	{ type: 'wait', milliseconds: 1500 },
	{ type: 'executeJavascript', script: AGE_GATE_BYPASS_SCRIPT },
	{ type: 'wait', milliseconds: 2500 },
	{
		type: 'executeJavascript',
		script: `
			(() => {
				const title = (document.title || '').toLowerCase();
				const body = (document.body?.textContent || '').slice(0, 500).toLowerCase();
				if (/age\\s*verif|are you\\s+(?:18|21)|confirm\\s+your\\s+age|enter\\s+site/.test(title + body)) {
					window.location.reload();
					return 'reloaded';
				}
				return 'ok';
			})();
		`
	},
	{ type: 'wait', milliseconds: 2500 },
	{ type: 'scrape' }
];

export interface FirecrawlSignalsResult {
	stack: StackSignals;
	aiReadinessPartial: Omit<AiReadinessSignals, 'llms_txt' | 'robots_txt' | 'sitemap_xml'>;
	content: ContentSignals;
	/** sha256-able normalized markdown source, for change-detection. */
	markdown: string;
	/** acquisition path used — surfaced in errors for transparency. */
	source: 'firecrawl' | 'fetch';
	error: string | null;
}

/**
 * Plain server-side fetch fallback when Firecrawl is unavailable. NO JS
 * render — SPAs read thin. Returns a ScrapeResult-shaped object so the rest
 * of the pipeline is path-agnostic.
 */
async function fetchScrape(url: string): Promise<ScrapeResult | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 15_000);
	try {
		const r = await fetch(url, {
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'User-Agent': 'PxpAudit/0.1 (+https://parallaxandpixel.com)' }
		});
		if (!r.ok) return null;
		const html = await r.text();
		const $ = cheerio.load(html);
		// Crude markdown stand-in: visible body text, whitespace-collapsed.
		$('script, style, noscript').remove();
		const markdown = $('body').text().replace(/\s+/g, ' ').trim();
		const title = $('title').first().text() || undefined;
		return {
			url,
			markdown,
			html,
			rawHtml: html,
			metadata: title ? { title } : {},
			fromCache: false
		};
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

export async function gatherFirecrawlSignals(url: string): Promise<FirecrawlSignalsResult> {
	const useFirecrawl = hasFirecrawl();
	const source: 'firecrawl' | 'fetch' = useFirecrawl ? 'firecrawl' : 'fetch';

	const scrape = useFirecrawl
		? await scrapeWithCache(url, { html: true, rawHtml: true })
		: await fetchScrape(url);

	if (!scrape) {
		return {
			stack: emptyStack(),
			aiReadinessPartial: emptyAiReadiness(),
			content: emptyContent(),
			markdown: '',
			source,
			error: 'scrape failed'
		};
	}

	let html = scrape.html ?? '';
	let rawHtml = scrape.rawHtml ?? '';
	let markdown = scrape.markdown ?? '';
	const metaTitle =
		typeof scrape.metadata?.title === 'string' ? (scrape.metadata.title as string) : undefined;

	// Age-gate bypass — only available on the Firecrawl path (needs actions).
	if (useFirecrawl && looksLikeAgeGate(markdown, html, metaTitle)) {
		const bypassed = await scrapeWithCache(url, {
			html: true,
			rawHtml: true,
			actions: AGE_GATE_BYPASS_ACTIONS
		});
		if (bypassed) {
			const bypassMarkdown = bypassed.markdown ?? '';
			const bypassMeta =
				typeof bypassed.metadata?.title === 'string'
					? (bypassed.metadata.title as string)
					: undefined;
			if (bypassRevealedContent(bypassMarkdown, bypassMeta)) {
				html = bypassed.html ?? '';
				rawHtml = bypassed.rawHtml ?? '';
				markdown = bypassMarkdown;
			}
		}
	}

	// Combine rawHtml (authoritative for head metadata) with the cleaned html
	// (authoritative for rendered DOM). Covers SSR + CSR cases.
	const combinedHtml = rawHtml
		? `${rawHtml}\n<!-- pxp-audit: end rawHtml -->\n${html}`
		: html;

	return {
		stack: detectStack(combinedHtml),
		aiReadinessPartial: extractAiReadiness(combinedHtml),
		content: extractContent(markdown, combinedHtml),
		markdown,
		source,
		error: null
	};
}

function extractAiReadiness(
	html: string
): Omit<AiReadinessSignals, 'llms_txt' | 'robots_txt' | 'sitemap_xml'> {
	const schemaTypes = extractSchemaLdTypes(html);
	return {
		has_schema_ld: schemaTypes.length > 0,
		schema_types: schemaTypes,
		has_opengraph: /<meta[^>]+property=["']og:/i.test(html),
		has_twitter_card: /<meta[^>]+name=["']twitter:card["']/i.test(html),
		has_canonical: /<link[^>]+rel=["']canonical["']/i.test(html),
		semantic_html_ratio: computeSemanticRatio(html),
		html_lang: extractHtmlLang(html)
	};
}

function extractSchemaLdTypes(html: string): string[] {
	const types: string[] = [];
	const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) {
		try {
			const parsed = JSON.parse(m[1]!.trim());
			collectTypes(parsed, types);
		} catch {
			types.push('(malformed)');
		}
	}
	return [...new Set(types)];
}

function collectTypes(node: unknown, out: string[]): void {
	if (node === null || node === undefined) return;
	if (Array.isArray(node)) {
		for (const item of node) collectTypes(item, out);
		return;
	}
	if (typeof node === 'object') {
		const obj = node as Record<string, unknown>;
		const t = obj['@type'];
		if (typeof t === 'string') out.push(t);
		else if (Array.isArray(t)) for (const s of t) if (typeof s === 'string') out.push(s);
		for (const v of Object.values(obj)) collectTypes(v, out);
	}
}

function computeSemanticRatio(html: string): number {
	const landmarkRe = /<(?:header|nav|main|article|section|aside|footer)\b/gi;
	const blockRe = /<(?:div|section|header|nav|main|article|aside|footer|p|span)\b/gi;
	const landmarks = html.match(landmarkRe)?.length ?? 0;
	const blocks = html.match(blockRe)?.length ?? 0;
	if (blocks === 0) return 0;
	return landmarks / blocks;
}

function extractHtmlLang(html: string): string | null {
	const m = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
	return m?.[1] ?? null;
}

function extractContent(markdown: string, html: string): ContentSignals {
	const words = markdown.trim().split(/\s+/).filter(Boolean);
	const hasBlog =
		/\bblog\b|\bnews\b|\barticles?\b/i.test(markdown) &&
		/<a[^>]+href=["'][^"']*(?:\/blog|\/news|\/articles)/i.test(html);

	const copyrightMatches = [
		...html.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,20}(\d{4})/gi),
		...markdown.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,20}(\d{4})/gi)
	];
	const years = copyrightMatches
		.map((m) => parseInt(m[1]!, 10))
		.filter((y) => !Number.isNaN(y) && y > 1999 && y <= new Date().getFullYear() + 1);
	const copyrightYear = years.length > 0 ? Math.max(...years) : null;

	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);

	return {
		word_count: words.length,
		has_blog: hasBlog,
		copyright_year: copyrightYear,
		title_length: titleMatch?.[1]?.trim().length ?? 0,
		description_length: descMatch?.[1]?.trim().length ?? 0
	};
}

function emptyStack(): StackSignals {
	return {
		cms: null,
		cms_version: null,
		has_jquery: false,
		jquery_version: null,
		has_react: false,
		has_vue: false,
		has_svelte: false,
		has_angular: false,
		has_viewport_meta: false,
		has_cdn: false,
		cdn_provider: null,
		detected_tech: []
	};
}

function emptyAiReadiness(): Omit<AiReadinessSignals, 'llms_txt' | 'robots_txt' | 'sitemap_xml'> {
	return {
		has_schema_ld: false,
		schema_types: [],
		has_opengraph: false,
		has_twitter_card: false,
		has_canonical: false,
		semantic_html_ratio: 0,
		html_lang: null
	};
}

function emptyContent(): ContentSignals {
	return {
		word_count: 0,
		has_blog: false,
		copyright_year: null,
		title_length: 0,
		description_length: 0
	};
}

export function assembleSignals(
	url: string,
	fromFirecrawl: FirecrawlSignalsResult,
	fromProbes: {
		aiReadinessPartial: Pick<AiReadinessSignals, 'llms_txt' | 'robots_txt' | 'sitemap_xml'>;
		tls: Signals['tls'];
		errors: string[];
	},
	fromLighthouse: Signals['lighthouse'],
	fromLighthouseDesktop?: Signals['lighthouse_desktop']
): Signals {
	const errors: string[] = [...fromProbes.errors];
	if (fromFirecrawl.error) errors.push(`scrape: ${fromFirecrawl.error}`);
	if (fromFirecrawl.source === 'fetch') {
		errors.push('scrape via plain fetch (no JS render) — Firecrawl not configured');
	}

	return {
		url,
		lighthouse: fromLighthouse,
		lighthouse_desktop: fromLighthouseDesktop ?? null,
		stack: fromFirecrawl.stack,
		ai_readiness: {
			...fromFirecrawl.aiReadinessPartial,
			...fromProbes.aiReadinessPartial
		},
		content: fromFirecrawl.content,
		tls: fromProbes.tls,
		gathered_at: new Date().toISOString(),
		errors
	};
}

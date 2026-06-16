/**
 * Playwright PDF render service for the Deep Audit report.
 *
 * Launches a single headless Chromium (lazy singleton, reused across renders),
 * navigates to the hidden, render-token-guarded `/audit/{id}/report` route, waits
 * for webfonts + network idle, and captures the page as an A4 PDF Buffer.
 *
 * Chromium requirement
 * ────────────────────
 * Playwright needs the Chromium browser binary installed. In CI / the
 * Coolify/Midgard deploy this MUST run once after `pnpm install`:
 *
 *     npx playwright install chromium
 *
 * (or `npx playwright install --with-deps chromium` on a fresh Linux box to also
 * pull the shared system libraries Chromium links against.)
 *
 * If the binary is missing, `renderAuditPdf` throws a clear, actionable error so
 * the caller can log it. PDF generation is non-fatal — the audit scores still
 * render on the result page.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { env as publicEnv } from '$env/dynamic/public';
import { createLogger } from '$lib/server/logger';

const log = createLogger('audit/pdf/render');

// Resolved once and cached. `undefined` = not yet resolved; a string is the
// chosen executable path; `null` = nothing found, let Playwright try its own
// bundled binary.
let chromiumPathCache: string | null | undefined;

/**
 * Find the Chromium executable to launch, in priority order:
 *   1. PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH (set by nixpacks start cmd / Coolify)
 *   2. a `chromium`-family binary on PATH (the Nix `chromium` package puts a
 *      wrapper there; this is what saves us when the start-command env var
 *      didn't survive — e.g. Coolify overrode the start command)
 *   3. common absolute locations
 *   4. give up and return undefined so Playwright uses its bundled download
 *
 * Returning a real system/Nix binary here means PDF rendering no longer depends
 * on `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(which chromium)` being shell-evaluated
 * at container start.
 */
function resolveChromiumPath(): string | undefined {
	if (chromiumPathCache !== undefined) return chromiumPathCache ?? undefined;

	const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
	if (envPath && existsSync(envPath)) {
		chromiumPathCache = envPath;
		log.info('chromium resolved from env', { path: envPath });
		return envPath;
	}

	const names = ['chromium', 'chromium-browser', 'google-chrome-stable', 'google-chrome', 'chrome'];
	for (const name of names) {
		try {
			const found = execFileSync('which', [name], { encoding: 'utf8' }).trim();
			if (found && existsSync(found)) {
				chromiumPathCache = found;
				log.info('chromium resolved from PATH', { name, path: found });
				return found;
			}
		} catch {
			/* not on PATH — try the next candidate */
		}
	}

	const absolute = [
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
		'/usr/bin/google-chrome',
		'/run/current-system/sw/bin/chromium'
	];
	for (const p of absolute) {
		if (existsSync(p)) {
			chromiumPathCache = p;
			log.info('chromium resolved from absolute path', { path: p });
			return p;
		}
	}

	chromiumPathCache = null;
	log.warn('no system/Nix chromium found; falling back to Playwright bundled binary');
	return undefined;
}

// `playwright` is imported lazily inside ensureBrowser() so a missing/unbuilt
// module never crashes the whole module graph at import time. The audit result
// page must keep working even when Chromium is unavailable. We avoid a static
// `import type` so type-checking doesn't fail in environments where the package
// is declared but not yet installed — the lazy import is fully typed at runtime.
type PwBrowser = {
	isConnected(): boolean;
	close(): Promise<void>;
	newContext(): Promise<{
		newPage(): Promise<PwPage>;
		close(): Promise<void>;
	}>;
};
type PwPage = {
	emulateMedia(opts: { media: 'print' | 'screen' }): void | Promise<void>;
	goto(
		url: string,
		opts?: { waitUntil?: string; timeout?: number }
	): Promise<{ ok(): boolean; status(): number } | null>;
	evaluate<T>(fn: () => T): Promise<T>;
	waitForFunction(fn: () => unknown, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
	pdf(opts: Record<string, unknown>): Promise<Buffer>;
	close(): Promise<void>;
};

// Lazy singleton browser. Launched on first render, reused after.
let browserPromise: Promise<PwBrowser> | null = null;

function isMissingBrowserError(message: string): boolean {
	const m = message.toLowerCase();
	return (
		m.includes("executable doesn't exist") ||
		m.includes('please run the following command to download') ||
		m.includes('npx playwright install') ||
		m.includes('failed to launch') ||
		m.includes('cannot find module')
	);
}

async function ensureBrowser(): Promise<PwBrowser> {
	if (browserPromise) {
		// Reuse the existing instance unless it has disconnected.
		try {
			const b = await browserPromise;
			if (b.isConnected()) return b;
		} catch {
			// fall through to relaunch
		}
		browserPromise = null;
	}

	browserPromise = (async () => {
		let chromium: {
			launch(opts: Record<string, unknown>): Promise<PwBrowser>;
		};
		try {
			// Indirect specifier keeps the TS checker from hard-failing when the
			// optional `playwright` package isn't installed yet (CI without browsers).
			// A non-literal specifier is treated as a dynamic any-import.
			const pkg = 'playwright';
			const mod = (await import(/* @vite-ignore */ pkg)) as unknown as {
				chromium: { launch(opts: Record<string, unknown>): Promise<PwBrowser> };
			};
			chromium = mod.chromium;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			throw new Error(
				`Playwright module not available (${msg}). Install deps + browser: pnpm install && npx playwright install chromium`
			);
		}
		try {
			return await chromium.launch({
				headless: true,
				// On the Nixpacks/Coolify container Chromium is the Nix `chromium`
				// package, not Playwright's bundled binary. resolveChromiumPath()
				// finds it (env override → PATH → common locations) so we don't
				// depend on the start-command env var being shell-evaluated. Falls
				// back to undefined locally (dev machines that ran
				// `npx playwright install chromium`).
				executablePath: resolveChromiumPath(),
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					// /dev/shm is tiny in Docker — without this Chromium crashes
					// rendering anything non-trivial.
					'--disable-dev-shm-usage',
					'--font-render-hinting=none'
				]
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (isMissingBrowserError(msg)) {
				throw new Error(
					`Chromium browser binary not installed. Run: npx playwright install chromium (original: ${msg})`
				);
			}
			throw new Error(`Failed to launch Chromium for PDF render: ${msg}`);
		}
	})();

	try {
		return await browserPromise;
	} catch (e) {
		// Reset so the next call can retry a clean launch.
		browserPromise = null;
		throw e;
	}
}

/**
 * Render the audit report to a PDF Buffer.
 *
 * @param auditId  the audit row id
 * @param token    the one-time pdf_render_token the /report route validates
 * @returns        the A4 PDF as a Node Buffer
 * @throws         a descriptive Error on launch / navigation / render failure
 */
export async function renderAuditPdf(auditId: string, token: string): Promise<Buffer> {
	const base = (publicEnv.PUBLIC_SITE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
	const url = `${base}/audit/${encodeURIComponent(auditId)}/report?token=${encodeURIComponent(token)}`;

	const browser = await ensureBrowser();
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		page.emulateMedia({ media: 'print' });
		const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
		if (resp && !resp.ok()) {
			throw new Error(`report route returned HTTP ${resp.status()} for audit ${auditId}`);
		}

		// Webfonts (Montserrat + Inter) must be ready or the report falls back to
		// system fonts and the layout / line-breaks shift.
		await page.evaluate(() => (document as Document).fonts.ready);
		// Belt-and-braces: the report page sets data-report-ready once mounted.
		await page
			.waitForFunction(() => document.documentElement.dataset.reportReady === '1', null, {
				timeout: 5_000
			})
			.catch(() => {
				/* page may not set the flag in older builds; fonts.ready is enough */
			});

		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true,
			margin: { top: '0', right: '0', bottom: '0', left: '0' },
			preferCSSPageSize: true
		});

		log.info('rendered audit pdf', { auditId, bytes: pdf.length });
		return pdf;
	} finally {
		await page.close().catch(() => {});
		await context.close().catch(() => {});
	}
}

/** Close the shared browser. Call on graceful shutdown if wired up. */
export async function disposePdfBrowser(): Promise<void> {
	if (!browserPromise) return;
	try {
		const b = await browserPromise;
		await b.close();
	} catch {
		/* ignore */
	} finally {
		browserPromise = null;
	}
}

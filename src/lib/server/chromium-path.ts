// Shared Chromium executable resolver for server-side Playwright rendering
// (Daedalus PDF export, etc.). Priority: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH env →
// a chromium-family binary on PATH → common absolute locations → undefined (let
// Playwright use its bundled download). Returning a real system/Nix binary means
// PDF rendering doesn't depend on the start-command env var being shell-evaluated.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createLogger } from '$lib/server/logger';

const log = createLogger('chromium-path');

// undefined = not resolved yet; string = chosen path; null = nothing found.
let cache: string | null | undefined;

export function resolveChromiumPath(): string | undefined {
	if (cache !== undefined) return cache ?? undefined;

	const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
	if (envPath && existsSync(envPath)) {
		cache = envPath;
		return envPath;
	}

	const names = ['chromium', 'chromium-browser', 'google-chrome-stable', 'google-chrome', 'chrome'];
	for (const name of names) {
		try {
			const found = execFileSync('which', [name], { encoding: 'utf8' }).trim();
			if (found && existsSync(found)) {
				cache = found;
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
			cache = p;
			return p;
		}
	}

	cache = null;
	log.warn('no system/Nix chromium found; falling back to Playwright bundled binary');
	return undefined;
}

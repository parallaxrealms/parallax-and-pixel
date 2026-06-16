// Bifrost API authentication helper.
//
// The `/api/bifrost/*` endpoints are hit by the Bifrost daemon, not a logged-in
// user — so they authenticate with a single shared bearer token whose value is
// the env var `BIFROST_API_KEY` (read via $env/dynamic/private). On success this
// returns `{ ok: true }`; on failure `{ ok: false, response }` with a JSON
// Response ready to return from the +server.ts handler.

import { json, type RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time bearer-token comparison. Both sides are SHA-256 hashed first so
 * the digests are always the same length — this avoids `timingSafeEqual`
 * throwing on a length mismatch and removes the token-length side channel a raw
 * `!==` would leak.
 */
function tokensMatch(provided: string, expected: string): boolean {
	const a = createHash('sha256').update(provided).digest();
	const b = createHash('sha256').update(expected).digest();
	return timingSafeEqual(a, b);
}

export interface BifrostAuthOk {
	ok: true;
}

export interface BifrostAuthFail {
	ok: false;
	response: Response;
}

export type BifrostAuthResult = BifrostAuthOk | BifrostAuthFail;

/**
 * Validate `Authorization: Bearer <token>` against `BIFROST_API_KEY`.
 * Returns a 503 when the key is unconfigured, 401 when the bearer is wrong.
 */
export function requireBifrostAuth(event: RequestEvent): BifrostAuthResult {
	const expected = env.BIFROST_API_KEY;

	if (!expected || expected.length < 16) {
		return {
			ok: false,
			response: json({ error: 'Bifrost API not configured on this server.' }, { status: 503 })
		};
	}

	const header = event.request.headers.get('authorization') ?? '';
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	const provided = match?.[1]?.trim();

	if (!provided || !tokensMatch(provided, expected)) {
		return {
			ok: false,
			response: json({ error: 'Unauthorized' }, { status: 401 })
		};
	}

	return { ok: true };
}

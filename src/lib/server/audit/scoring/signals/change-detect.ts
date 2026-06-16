/**
 * Content-hash helpers. Ported from 9realms'
 * `scoring/signals/change-detect.ts`.
 *
 * 9realms uses these to short-circuit re-scoring a prospect whose content
 * hasn't changed (comparing against a prior prospect_scores row). PXP
 * has no prior-scores table to diff against in this slice, so we only port
 * the pure hash functions — they populate `signals.content_hash` so a
 * future re-run / Watch subscription (Slice 5) can compare. The DB-bound
 * helpers (getLastScoredHash / logChangeCheck) are intentionally omitted.
 */

import crypto from 'node:crypto';

/**
 * Normalize markdown so transient noise (dates, session IDs) doesn't trip
 * false content-changed signals. Applied before hashing.
 */
export function normalizeForHash(markdown: string): string {
	return markdown
		.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '')
		.replace(/\b\d{9,}\b/g, '')
		.replace(/[?&](?:utm_[a-z_]+|ref|src)=[^\s&]*/gi, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Stable sha256 of the normalized markdown. */
export function computeContentHash(markdown: string): string {
	return crypto.createHash('sha256').update(normalizeForHash(markdown)).digest('hex');
}

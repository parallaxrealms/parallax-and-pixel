import { env } from '$env/dynamic/private';

/**
 * Server-side Prometheus client. Wraps the HTTP API.
 * Ported from 9realms (ODIN) — same wire contract as the pxp-otel-stack.
 *
 * Reads PROMETHEUS_URL from the env (e.g. https://prom.yggdrasil.quest).
 * Auth (pick one):
 *   - PROMETHEUS_BEARER=<token>            → Authorization: Bearer <token>
 *   - PROMETHEUS_BASIC_AUTH=user:password  → Authorization: Basic <base64>
 */

export interface PromMatrixResult {
	metric: Record<string, string>;
	values: [number, string][];
}

export interface PromVectorResult {
	metric: Record<string, string>;
	value: [number, string];
}

export interface PromRangeResponse {
	status: 'success' | 'error';
	data?: { resultType: 'matrix'; result: PromMatrixResult[] };
	errorType?: string;
	error?: string;
}

export interface PromInstantResponse {
	status: 'success' | 'error';
	data?: { resultType: 'vector'; result: PromVectorResult[] };
	errorType?: string;
	error?: string;
}

function baseUrl(): string {
	const url = env.PROMETHEUS_URL?.trim();
	if (!url) throw new Error('PROMETHEUS_URL is not configured');
	return url.replace(/\/+$/, '');
}

function authHeaders(): Record<string, string> {
	const headers: Record<string, string> = { Accept: 'application/json' };
	const bearer = env.PROMETHEUS_BEARER?.trim();
	const basic = env.PROMETHEUS_BASIC_AUTH?.trim();
	if (bearer) {
		headers.Authorization = `Bearer ${bearer}`;
	} else if (basic) {
		headers.Authorization = `Basic ${Buffer.from(basic).toString('base64')}`;
	}
	return headers;
}

export async function promQueryRange(
	query: string,
	startSec: number,
	endSec: number,
	stepSec: number,
	signal?: AbortSignal
): Promise<PromRangeResponse> {
	const url = new URL(`${baseUrl()}/api/v1/query_range`);
	url.searchParams.set('query', query);
	url.searchParams.set('start', String(startSec));
	url.searchParams.set('end', String(endSec));
	url.searchParams.set('step', String(stepSec));
	const res = await fetch(url, { headers: authHeaders(), signal });
	if (!res.ok) {
		return { status: 'error', errorType: 'http', error: `HTTP ${res.status}` };
	}
	return (await res.json()) as PromRangeResponse;
}

export async function promQuery(
	query: string,
	timeSec?: number,
	signal?: AbortSignal
): Promise<PromInstantResponse> {
	const url = new URL(`${baseUrl()}/api/v1/query`);
	url.searchParams.set('query', query);
	if (timeSec !== undefined) url.searchParams.set('time', String(timeSec));
	const res = await fetch(url, { headers: authHeaders(), signal });
	if (!res.ok) {
		return { status: 'error', errorType: 'http', error: `HTTP ${res.status}` };
	}
	return (await res.json()) as PromInstantResponse;
}

export function isPrometheusConfigured(): boolean {
	return Boolean(env.PROMETHEUS_URL?.trim());
}

/**
 * Parse a relative range string like "now-6h" into seconds-from-now.
 * Returns positive seconds (how far back).
 */
export function parseRangeSeconds(range: string): number {
	const m = /^now-(\d+)([smhdw])$/.exec(range);
	if (!m) return 6 * 3600;
	const n = Number(m[1]);
	switch (m[2]) {
		case 's':
			return n;
		case 'm':
			return n * 60;
		case 'h':
			return n * 3600;
		case 'd':
			return n * 86400;
		case 'w':
			return n * 7 * 86400;
		default:
			return 6 * 3600;
	}
}

/**
 * Pick a sensible step (resolution) for a given window so we get ~120-240 points.
 */
export function pickStep(rangeSec: number): number {
	const target = 180;
	const raw = Math.max(15, Math.floor(rangeSec / target));
	const buckets = [15, 30, 60, 120, 300, 600, 1800, 3600, 7200, 21600, 86400];
	for (const b of buckets) {
		if (raw <= b) return b;
	}
	return 86400;
}

/**
 * Client-side helper for querying Prometheus via the admin telemetry proxy.
 * Ported from 9realms (ODIN).
 */

import type { ChartSeries as Series } from '$lib/components/dashboardTabs/telemetry/charts/types';
export type { ChartSeries as Series } from '$lib/components/dashboardTabs/telemetry/charts/types';

export interface QuerySpec {
	key: string;
	expr: string;
	instant?: boolean;
}

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
	error?: string;
}

export interface PromInstantResponse {
	status: 'success' | 'error';
	data?: { resultType: 'vector'; result: PromVectorResult[] };
	error?: string;
}

export interface TelemetryResponse {
	configured: boolean;
	range?: { start: number; end: number; step: number };
	results: Record<string, PromRangeResponse | PromInstantResponse>;
}

export async function runTelemetryQueries(
	queries: QuerySpec[],
	range: string,
	signal?: AbortSignal
): Promise<TelemetryResponse> {
	const res = await fetch('/api/telemetry/query', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ queries, range }),
		signal
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return (await res.json()) as TelemetryResponse;
}

/**
 * Convert a Prom matrix result into a single Series.
 * `label` and `color` are passed-through.
 */
export function matrixToSeries(
	resp: PromRangeResponse | PromInstantResponse | undefined,
	opts: {
		key: string;
		label: string;
		color: string;
		seriesIdx?: number;
		dashed?: boolean;
	}
): Series {
	const empty: Series = {
		key: opts.key,
		label: opts.label,
		color: opts.color,
		points: [],
		dashed: opts.dashed
	};
	if (!resp || resp.status !== 'success' || !resp.data) return empty;
	if (resp.data.resultType !== 'matrix') return empty;
	const result = (resp.data.result as PromMatrixResult[])[opts.seriesIdx ?? 0];
	if (!result) return empty;
	const points = result.values.map(([t, v]) => {
		const num = Number(v);
		return { t, v: isFinite(num) ? num : null };
	});
	return {
		key: opts.key,
		label: opts.label,
		color: opts.color,
		points,
		dashed: opts.dashed
	};
}

/**
 * Build a Series per matrix-result entry, deriving label from a metric label.
 */
export function matrixToMultiSeries(
	resp: PromRangeResponse | PromInstantResponse | undefined,
	opts: {
		keyPrefix: string;
		labelFromMetric: (m: Record<string, string>) => string;
		colorFor: (label: string, idx: number) => string;
	}
): Series[] {
	if (!resp || resp.status !== 'success' || !resp.data) return [];
	if (resp.data.resultType !== 'matrix') return [];
	return (resp.data.result as PromMatrixResult[]).map((r, i) => {
		const label = opts.labelFromMetric(r.metric);
		const points = r.values.map(([t, v]) => {
			const num = Number(v);
			return { t, v: isFinite(num) ? num : null };
		});
		return {
			key: `${opts.keyPrefix}-${i}`,
			label,
			color: opts.colorFor(label, i),
			points
		};
	});
}

export function instantValue(
	resp: PromRangeResponse | PromInstantResponse | undefined
): number | null {
	if (!resp || resp.status !== 'success' || !resp.data) return null;
	if (resp.data.resultType === 'vector') {
		const r = (resp.data.result as PromVectorResult[])[0];
		if (!r) return null;
		const n = Number(r.value[1]);
		return isFinite(n) ? n : null;
	}
	if (resp.data.resultType === 'matrix') {
		const r = (resp.data.result as PromMatrixResult[])[0];
		if (!r || r.values.length === 0) return null;
		const last = r.values[r.values.length - 1]![1];
		const n = Number(last);
		return isFinite(n) ? n : null;
	}
	return null;
}

export function formatNumber(n: number | null, digits = 2): string {
	if (n === null || !isFinite(n)) return '·';
	if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
	if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k';
	return n.toFixed(digits);
}

export function formatBytes(n: number | null): string {
	if (n === null || !isFinite(n)) return '·';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let v = n;
	let u = 0;
	while (v >= 1024 && u < units.length - 1) {
		v /= 1024;
		u++;
	}
	return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[u]}`;
}

export function formatPercent(n: number | null, digits = 1): string {
	if (n === null || !isFinite(n)) return '·';
	return n.toFixed(digits) + '%';
}

export function formatMs(n: number | null): string {
	if (n === null || !isFinite(n)) return '·';
	if (n >= 1000) return (n / 1000).toFixed(2) + 's';
	return n.toFixed(0) + 'ms';
}

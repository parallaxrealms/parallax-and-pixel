import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-guard';
import {
	isPrometheusConfigured,
	parseRangeSeconds,
	pickStep,
	promQuery,
	promQueryRange
} from '$lib/server/prometheus';

/**
 * Telemetry query proxy. Admin-only — /api routes are NOT covered by the
 * (admin) layout guard, so the session + role check happens here.
 *
 * POST body: { queries: { key: string; expr: string; instant?: boolean }[], range?: string }
 *   - range is a relative string ("now-6h"). Defaults to "now-6h".
 *   - instant queries return a single value; range queries return time series.
 */

interface QuerySpec {
	key: string;
	expr: string;
	instant?: boolean;
}

interface Body {
	queries: QuerySpec[];
	range?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	if (!isPrometheusConfigured()) {
		return json({ configured: false, results: {} }, { status: 200 });
	}

	const body = (await request.json().catch(() => null)) as Body | null;
	if (!body || !Array.isArray(body.queries) || body.queries.length === 0) {
		throw error(400, 'queries[] required');
	}
	if (body.queries.length > 32) {
		throw error(400, 'too many queries');
	}

	const rangeSec = parseRangeSeconds(body.range ?? 'now-6h');
	const end = Math.floor(Date.now() / 1000);
	const start = end - rangeSec;
	const step = pickStep(rangeSec);

	const settled = await Promise.allSettled(
		body.queries.map((q) =>
			q.instant ? promQuery(q.expr, end) : promQueryRange(q.expr, start, end, step)
		)
	);

	const results: Record<string, unknown> = {};
	for (let i = 0; i < body.queries.length; i++) {
		const q = body.queries[i]!;
		const s = settled[i]!;
		if (s.status === 'fulfilled') {
			results[q.key] = s.value;
		} else {
			results[q.key] = { status: 'error', error: String(s.reason) };
		}
	}

	return json({ configured: true, range: { start, end, step }, results });
};

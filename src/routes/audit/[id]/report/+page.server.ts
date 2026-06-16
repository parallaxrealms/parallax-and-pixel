import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';
import { createLogger } from '$lib/server/logger';
import type { QualityResult, Finding, Signals } from '$lib/server/audit/scoring/types';
import { buildReportModel, type ReportModel } from '$lib/server/audit/pdf/model';
import { buildPreviewModel } from '$lib/server/audit/pdf/previewFixture';

const log = createLogger('routes/audit/[id]/report');

/**
 * Server load for the HIDDEN, Playwright-rendered PDF report route.
 *
 * Access control: this route is rendered headless (no session cookie), so it
 * cannot use the normal session ownership check. Instead it is guarded by a
 * short-lived `pdf_render_token`:
 *   - `generateAndDeliverPdf` writes a fresh random token to the audit row,
 *     then navigates Playwright to ?token=<token>.
 *   - This load 404s unless the query token matches the stored token.
 *   - The token is cleared by the delivery pipeline after capture.
 * Without a valid token an attacker enumerating audit IDs gets a flat 404.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	// Dev-only design preview: render the template with fixture data so the
	// report can be eyeballed at /audit/anything/report?preview=1 without a real
	// audit row or render token. `dev` guarantees this is stripped from prod.
	if (dev && url.searchParams.get('preview') === '1') {
		return { model: buildPreviewModel() };
	}

	const token = url.searchParams.get('token');
	if (!token) {
		throw error(404, 'Not found.');
	}

	const admin = getSupabaseAdmin();
	const { data: audit, error: dbErr } = await admin
		.from('audits')
		.select('id, url, status, scores, signals, pdf_render_token, created_at, completed_at')
		.eq('id', params.id)
		.maybeSingle();

	if (dbErr) {
		log.error('report lookup failed', dbErr);
		throw error(500, 'Could not load report.');
	}
	if (!audit) throw error(404, 'Not found.');

	// Constant-ish token check. Mismatch or missing stored token => 404.
	const stored = audit.pdf_render_token as string | null;
	if (!stored || stored !== token) {
		log.info('report token mismatch', { auditId: params.id });
		throw error(404, 'Not found.');
	}

	// Gate on SCORES, not status. PDF delivery (generateAndDeliverPdf) renders
	// this route AFTER scoring but BEFORE the worker flips status to 'complete'
	// (by design — see deliver.ts), so requiring status==='complete' here 409'd
	// every render. The valid pdf_render_token already authorizes this request,
	// and scores are the real precondition for building the report model.
	if (!audit.scores) {
		throw error(409, 'Audit has no scores yet.');
	}

	const { data: findingRows, error: findErr } = await admin
		.from('audit_findings')
		.select('pillar, severity, title, description, fix')
		.eq('audit_id', audit.id);
	if (findErr) log.error('report findings lookup failed', findErr);

	const model: ReportModel = buildReportModel({
		auditId: audit.id as string,
		url: audit.url as string,
		scores: audit.scores as QualityResult,
		signals: (audit.signals as Signals | null) ?? null,
		findings: (findingRows as Finding[] | null) ?? [],
		createdAt: (audit.completed_at as string | null) ?? (audit.created_at as string)
	});

	return { model };
};

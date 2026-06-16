/**
 * Audit PDF delivery — one public entry: `generateAndDeliverPdf(auditId)`.
 *
 * Called by the audit worker AFTER scoring succeeds, before it marks the audit
 * complete. The worker wraps this in try/catch — PDF failure is non-fatal, the
 * scores still render in the admin UI. This function THROWS on hard failure so
 * the caller can log it.
 *
 * Admin-only tool, so this is deliberately lean (no per-user retention, no
 * emailed share link — both belong to PXP's old customer-self-serve flow):
 *   1. Load the audit row (must have scores).
 *   2. Mint a one-time pdf_render_token, render the report to PDF (Playwright).
 *   3. Upload to the private `pxp-audits` Storage bucket at {audit_id}.pdf.
 *   4. Record pdf_storage_key + pdf_generated_at, clear the render token.
 *
 * The PDF is served back to admins by /api/admin/audit/[id]/report.pdf via
 * `streamAuditPdf` (serve.ts) — the bucket is private and never exposed.
 */

import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';
import { createLogger } from '$lib/server/logger';
import { renderAuditPdf } from './render';

const log = createLogger('audit/pdf/deliver');

export const AUDIT_BUCKET = 'pxp-audits';

function randomToken(): string {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function generateAndDeliverPdf(auditId: string): Promise<void> {
	const admin = getSupabaseAdmin();

	// 1. Load the audit row.
	const { data: audit, error: loadErr } = await admin
		.from('audits')
		.select('id, url, status, scores')
		.eq('id', auditId)
		.maybeSingle();

	if (loadErr || !audit) {
		throw new Error(
			`pdf deliver could not load audit ${auditId}: ${loadErr?.message ?? 'not found'}`
		);
	}
	if (!audit.scores) {
		throw new Error(`pdf deliver: audit ${auditId} has no scores; cannot render`);
	}

	// 2. Mint a one-time render token + render the PDF.
	const token = randomToken();
	const { error: tokErr } = await admin
		.from('audits')
		.update({ pdf_render_token: token, updated_at: new Date().toISOString() })
		.eq('id', auditId);
	if (tokErr) {
		throw new Error(`pdf deliver: could not set render token: ${tokErr.message}`);
	}

	let pdf: Buffer;
	try {
		pdf = await renderAuditPdf(auditId, token);
	} finally {
		// Always clear the token, even if render threw, so it cannot be reused.
		await admin
			.from('audits')
			.update({ pdf_render_token: null, updated_at: new Date().toISOString() })
			.eq('id', auditId)
			.then(undefined, () => {});
	}

	// 3. Upload to the private Storage bucket.
	const storageKey = `${auditId}.pdf`;
	const { error: upErr } = await admin.storage.from(AUDIT_BUCKET).upload(storageKey, pdf, {
		contentType: 'application/pdf',
		upsert: true
	});
	if (upErr) {
		throw new Error(`pdf deliver: storage upload failed for ${storageKey}: ${upErr.message}`);
	}
	log.info('pdf uploaded', { auditId, storageKey, bytes: pdf.length });

	// 4. Record the storage key.
	const { error: rowErr } = await admin
		.from('audits')
		.update({
			pdf_storage_key: storageKey,
			pdf_generated_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.eq('id', auditId);
	if (rowErr) {
		throw new Error(`pdf deliver: could not persist storage key: ${rowErr.message}`);
	}

	log.info('pdf delivered', { auditId });
}

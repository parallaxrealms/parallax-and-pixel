/**
 * Audit engine orchestrator. One public entry: `runAuditEngine(auditId)`.
 *
 * Structurally modeled on 9realms' `scoring/index.ts` (`runScoring`), but it
 * persists to PXP's OWN tables (`public.audits` + `public.audit_findings`)
 * via the service-role admin client, and produces customer-facing QUALITY
 * scores instead of internal opportunity scores.
 *
 * Flow:
 *   1. Load the audit row (must have url, status running/pending).
 *   2. Gather signals concurrently:
 *      - Firecrawl/fetch scrape (html+markdown) -> stack, ai-readiness, content
 *      - PageSpeed Insights -> Lighthouse scores + Web Vitals
 *      - Probes -> llms.txt, robots.txt, sitemap.xml, TLS
 *   3. computeQuality (pure) -> three pillar scores + overall
 *   4. deriveFindings (pure) -> findings list
 *   5. Persist: update audits row (status/scores/signals/step) + insert
 *      audit_findings rows.
 *
 * Durable run model: this is invoked by the audit WORKER (see
 * `src/lib/server/audit/worker.ts`) after it has atomically CLAIMED a queued
 * row (status flipped to 'running' by `claim_next_audit()`). The worker owns
 * ALL status transitions:
 *   - claim → status='running' (DB function, before this runs)
 *   - success → status='complete' (worker, after this returns)
 *   - throw   → status='failed'   (worker, in its catch — also issues refund)
 *
 * Therefore this function NO LONGER writes terminal status itself. It:
 *   - does NOT set 'running' (the claim already did, with started_at)
 *   - does NOT set 'complete' (the worker does, after PDF delivery)
 *   - does NOT swallow errors / set 'failed' — it THROWS so the worker can
 *     decide retry-vs-terminal and run the refund path.
 * It still writes step_label progress + scores/signals/findings, which are
 * non-terminal and safe for the engine to own.
 */

import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';
import { createLogger } from '$lib/server/logger';
import { gatherFirecrawlSignals, assembleSignals } from './signals/firecrawl-signals';
import { runLighthouse } from './signals/lighthouse';
import { runProbes } from './signals/probes';
import { computeContentHash } from './signals/change-detect';
import { computeQuality } from './quality';
import { deriveFindings } from './findings';

const log = createLogger('audit/engine');

// Step progression labels surfaced to the polling UI.
export const STEP_LABELS = {
	fetching: 'Fetching homepage…',
	lighthouse: 'Running Lighthouse…',
	ai: 'Checking AI-readiness…',
	seo: 'Analyzing SEO…',
	scoring: 'Scoring your site…',
	done: 'Done'
} as const;

/**
 * Run the full audit engine for one audit row. Returns nothing on success —
 * all output (scores/signals/findings) lands in the DB. THROWS on failure so
 * the calling worker can set status='failed' + refund the credit. The worker
 * owns the 'running' → 'complete'/'failed' transitions; this function only
 * writes progress + results, never terminal status.
 */
export async function runAuditEngine(auditId: string): Promise<void> {
	const admin = getSupabaseAdmin();

	// 1. Load the audit row. The worker's claim_next_audit() already set this
	//    row to status='running' with started_at, so we don't touch status.
	const { data: audit, error: loadErr } = await admin
		.from('audits')
		.select('id, url, status')
		.eq('id', auditId)
		.maybeSingle();

	if (loadErr || !audit) {
		// Non-recoverable: throw so the worker marks the row failed.
		throw new Error(`engine could not load audit ${auditId}: ${loadErr?.message ?? 'not found'}`);
	}
	const url = audit.url as string;

	// Clear any prior error from a previous attempt + surface the first step.
	await admin
		.from('audits')
		.update({
			step_label: STEP_LABELS.fetching,
			error: null,
			updated_at: new Date().toISOString()
		})
		.eq('id', auditId);

	log.info('engine start', { auditId, url });

	// NOTE: no try/catch around the engine body anymore — errors propagate to
	// the worker, which decides retry-vs-terminal and runs the refund.
	{
		// 2. Gather signals. Firecrawl/fetch + probes are quick; Lighthouse is
		// the long pole. We surface a coarse step label before kicking the
		// parallel gather, then advance once it resolves.
		await setStep(admin, auditId, STEP_LABELS.lighthouse);

		const [firecrawlSignals, probeResult, lighthouseMobile] = await Promise.all([
			gatherFirecrawlSignals(url),
			runProbes(url),
			runLighthouse(url, { strategy: 'mobile' })
		]);

		await setStep(admin, auditId, STEP_LABELS.ai);

		const signals = assembleSignals(
			url,
			firecrawlSignals,
			probeResult,
			lighthouseMobile.signals,
			null
		);
		if (lighthouseMobile.error) {
			signals.errors.push(`lighthouse mobile: ${lighthouseMobile.error}`);
		}
		// Populate content_hash for future re-run / Watch comparison.
		if (firecrawlSignals.markdown) {
			signals.content_hash = computeContentHash(firecrawlSignals.markdown);
		}

		await setStep(admin, auditId, STEP_LABELS.seo);

		// 3 + 4. Pure computations.
		await setStep(admin, auditId, STEP_LABELS.scoring);
		const quality = computeQuality(signals);
		const findings = deriveFindings(signals);

		// 5. Persist findings first (so they exist before status flips to
		// complete and the UI tries to render them), then the scores. Clear any
		// prior findings for idempotency on a re-run / retry.
		await admin.from('audit_findings').delete().eq('audit_id', auditId);
		if (findings.length > 0) {
			const rows = findings.map((f) => ({
				audit_id: auditId,
				pillar: f.pillar,
				severity: f.severity,
				title: f.title,
				description: f.description,
				fix: f.fix
			}));
			const { error: findErr } = await admin.from('audit_findings').insert(rows);
			// Findings are non-fatal cosmetic output; log but don't throw.
			if (findErr) log.error('findings insert failed', { auditId, err: findErr.message });
		}

		// Write scores/signals but NOT terminal status — the worker flips
		// status to 'complete' after best-effort PDF delivery. We leave
		// step_label at 'scoring'; the worker advances it to 'done'.
		await admin
			.from('audits')
			.update({
				scores: quality,
				signals,
				rubric_version: quality.rubric_version,
				updated_at: new Date().toISOString()
			})
			.eq('id', auditId);

		log.info('engine scored (worker will finalize)', {
			auditId,
			overall: quality.overall,
			perf: quality.performance,
			ai: quality.ai_readiness,
			seo: quality.seo,
			findings: findings.length
		});
	}
	// Any throw above propagates to the worker.
}

async function setStep(
	admin: ReturnType<typeof getSupabaseAdmin>,
	auditId: string,
	label: string
): Promise<void> {
	await admin
		.from('audits')
		.update({ step_label: label, updated_at: new Date().toISOString() })
		.eq('id', auditId);
}

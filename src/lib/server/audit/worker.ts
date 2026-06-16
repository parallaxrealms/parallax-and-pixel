/**
 * Durable audit worker — a claimable-job queue built on the existing
 * `public.audits` table (NO pg-boss; PXP shares a multi-tenant Supabase
 * and can't add a `pgboss` schema or open a raw connection).
 *
 * Lifecycle of one audit:
 *   1. /api/admin/audit/run inserts a row status='queued'.
 *   2. This worker polls `claim_next_audit()` (~every 3s). That DB function
 *      atomically flips the oldest queued row to 'running' (FOR UPDATE SKIP
 *      LOCKED) and bumps `attempts`. Only ONE worker/tick can claim a row.
 *   3. The job body runs `runAuditEngine(id)` (signals → score → findings →
 *      scores written), then best-effort PDF delivery, then sets 'complete'.
 *   4. On ANY throw the worker decides:
 *        - attempts < MAX_ATTEMPTS → return it to 'queued' for retry.
 *        - attempts >= MAX_ATTEMPTS → set 'failed', store error (terminal).
 *
 * Restart recovery: a Node restart can orphan a row stuck in 'running'.
 * `reclaimStaleRunning()` (on boot + periodically) finds rows whose
 * started_at is older than STALE_TIMEOUT_MS and either re-queues them (if
 * attempts remain) or fails them (if exhausted). This is what makes
 * runs DURABLE across a process restart.
 *
 * Concurrency: single in-flight job for v1 (`busy` guard). Bumping this later
 * just means dropping the guard / running N claim loops — claim_next_audit()
 * is already concurrency-safe.
 */

import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';
import { createLogger } from '$lib/server/logger';
import { runAuditEngine, STEP_LABELS } from '$lib/server/audit/scoring';

const log = createLogger('audit/worker');

// Poll cadence is adaptive: fast while audits are flowing — and immediately
// after one is enqueued (wakeAuditWorker) — then it backs off to IDLE_POLL_MS
// once the queue has been empty, so an idle deployment isn't hammering the
// shared Supabase with a claim RPC every few seconds. Enqueue wakes the loop, so
// the idle interval only governs the safety-net poll (retries/reclaims/auto-audits).
const ACTIVE_POLL_MS = 3_000;
const IDLE_POLL_MS = 30_000;
// A 'running' row older than this is considered orphaned (process died
// mid-run). Lighthouse is the long pole; 8 min is comfortably above a normal
// run while still recovering quickly after a crash.
const STALE_TIMEOUT_MS = 8 * 60 * 1_000;
// How often to sweep for stale rows (cheap query; every minute is plenty).
const RECLAIM_INTERVAL_MS = 60 * 1_000;
// After this many attempts a job is failed terminally instead of re-queued.
const MAX_ATTEMPTS = 3;

// Module singletons — guard against double-start (HMR in dev, double import).
let started = false;
let stopped = false;
let cycleRunning = false; // a poll cycle (claim + run) is currently in flight
let wakeRequested = false; // an enqueue asked us to poll fast on the next cycle
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let reclaimTimer: ReturnType<typeof setInterval> | null = null;

type AuditRow = {
	id: string;
	url: string;
	status: string;
	attempts: number;
	started_at: string | null;
};

/**
 * Atomically claim the oldest queued audit. Returns the claimed row (now
 * status='running', attempts incremented) or null when the queue is empty.
 */
export async function claimNextAudit(): Promise<AuditRow | null> {
	const admin = getSupabaseAdmin();
	const { data, error } = await admin.rpc('claim_next_audit');
	if (error) {
		log.error('claim_next_audit rpc failed', { err: error.message });
		return null;
	}
	// The function returns a single composite row; an empty queue yields null
	// (or a row whose id is null, depending on PostgREST). Treat both as empty.
	const row = (Array.isArray(data) ? data[0] : data) as AuditRow | null;
	if (!row || !row.id) return null;
	return row;
}

/**
 * Recover jobs orphaned by a process restart. Any row stuck in 'running' with
 * started_at older than STALE_TIMEOUT_MS is either re-queued (attempts remain)
 * or failed+refunded (attempts exhausted). Run on boot + periodically.
 */
export async function reclaimStaleRunning(): Promise<void> {
	const admin = getSupabaseAdmin();
	const cutoff = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString();

	const { data: stale, error } = await admin
		.from('audits')
		.select('id, url, status, attempts, started_at')
		.eq('status', 'running')
		.lt('started_at', cutoff);

	if (error) {
		log.error('reclaim query failed', { err: error.message });
		return;
	}
	if (!stale || stale.length === 0) return;

	for (const row of stale as AuditRow[]) {
		if (row.attempts >= MAX_ATTEMPTS) {
			log.warn('reclaim: attempts exhausted → failing', {
				auditId: row.id,
				attempts: row.attempts
			});
			await failAudit(row.id, 'exceeded max attempts');
		} else {
			log.info('reclaim: re-queueing stale running audit', {
				auditId: row.id,
				attempts: row.attempts
			});
			await admin
				.from('audits')
				.update({
					status: 'queued',
					started_at: null,
					step_label: null,
					updated_at: new Date().toISOString()
				})
				.eq('id', row.id)
				// Guard against a race with a worker that just finished it.
				.eq('status', 'running');
		}
	}
}

/**
 * The claimed-row handler. Runs the engine, then best-effort PDF delivery,
 * then marks complete. On throw, decides retry-vs-terminal-fail.
 */
async function runJob(row: AuditRow): Promise<void> {
	const admin = getSupabaseAdmin();
	const auditId = row.id;
	log.info('job start', { auditId, url: row.url, attempt: row.attempts });

	try {
		// 1. Engine: signals → score → findings → scores written. Throws on
		//    failure; never sets terminal status (the worker owns that).
		await runAuditEngine(auditId);

		// 2. PDF delivery is owned by a separate agent and is NON-FATAL — the
		//    scores are valid regardless. Dynamic import so the worker still
		//    compiles/degrades if that file isn't present yet.
		try {
			const { generateAndDeliverPdf } = await import('$lib/server/audit/pdf/deliver');
			await generateAndDeliverPdf(auditId);
		} catch (pdfErr) {
			// Log but still mark complete; the result page handles null pdf
			// fields by offering a "report unavailable, retry" affordance.
			log.error('pdf delivery failed (non-fatal)', pdfErr);
		}

		// 3. Terminal success.
		await admin
			.from('audits')
			.update({
				status: 'complete',
				step_label: STEP_LABELS.done,
				completed_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			})
			.eq('id', auditId);

		log.info('job complete', { auditId });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		// row.attempts is the value AFTER claim incremented it, i.e. the count
		// of attempts made so far (1 on first run). Retry while under the cap.
		if (row.attempts < MAX_ATTEMPTS) {
			log.warn('job failed — re-queueing for retry', {
				auditId,
				attempt: row.attempts,
				err: msg
			});
			await admin
				.from('audits')
				.update({
					status: 'queued',
					started_at: null,
					error: msg, // keep last error visible while it retries
					updated_at: new Date().toISOString()
				})
				.eq('id', auditId)
				.eq('status', 'running');
		} else {
			log.error('job failed terminally', {
				auditId,
				attempt: row.attempts,
				err: msg
			});
			await failAudit(auditId, msg);
		}
	}
}

/**
 * Mark an audit terminally failed. Guarded so it doesn't clobber a row that
 * completed concurrently. Only ever called on TERMINAL failure (attempts
 * exhausted / non-recoverable), never on a transient failure that will retry.
 */
export async function failAudit(auditId: string, errorMsg: string): Promise<void> {
	const admin = getSupabaseAdmin();

	const { error: updErr } = await admin
		.from('audits')
		.update({
			status: 'failed',
			error: errorMsg,
			completed_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.eq('id', auditId)
		.in('status', ['running', 'queued']);

	if (updErr) {
		log.error('failAudit: status update failed', { auditId, err: updErr.message });
		return;
	}
	log.warn('failAudit: audit marked failed', { auditId, error: errorMsg });
}

/** Schedule the next poll cycle `delay` ms out (unref'd — never holds the loop open). */
function scheduleNext(delay: number): void {
	if (stopped) return;
	if (pollTimer) clearTimeout(pollTimer);
	pollTimer = setTimeout(() => void runPollCycle(), delay);
	pollTimer.unref?.();
}

/**
 * One poll cycle: claim the next audit and, if there is one, run it to
 * completion — then self-schedule. Fast cadence while work is flowing or right
 * after an enqueue; idle backoff when the queue is empty. Never overlaps itself
 * (the next cycle is scheduled only after the current one finishes).
 */
async function runPollCycle(): Promise<void> {
	if (cycleRunning) return; // defensive: never run two cycles concurrently
	cycleRunning = true;
	let foundWork = false;
	try {
		const row = await claimNextAudit();
		if (row) {
			foundWork = true;
			await runJob(row);
		}
	} catch (e) {
		// Defensive: a bug in claim/run shouldn't kill the poll loop.
		log.error('poll cycle error', e);
	} finally {
		cycleRunning = false;
		// Stay hot if we just did work or an enqueue pinged us mid-cycle; else back off.
		const fast = foundWork || wakeRequested;
		wakeRequested = false;
		scheduleNext(fast ? ACTIVE_POLL_MS : IDLE_POLL_MS);
	}
}

/**
 * Pull the next poll forward to NOW. Call right after enqueueing an audit so it
 * gets claimed near-instantly instead of waiting out the idle backoff. If a
 * cycle is mid-run, flag it so the loop re-polls fast the moment it finishes.
 */
export function wakeAuditWorker(): void {
	if (!started || stopped) return;
	if (cycleRunning) {
		wakeRequested = true;
		return;
	}
	scheduleNext(0);
}

/**
 * Idempotent bootstrap: start the poll loop + reclaim sweep, and do an initial
 * reclaim so a restart immediately recovers orphaned runs. Safe to call
 * multiple times (HMR, double import) — only the first call wires timers.
 */
export function startAuditWorker(): void {
	if (started) return;
	started = true;

	log.info('audit worker starting', {
		activePollMs: ACTIVE_POLL_MS,
		idlePollMs: IDLE_POLL_MS,
		reclaimMs: RECLAIM_INTERVAL_MS,
		staleMs: STALE_TIMEOUT_MS,
		maxAttempts: MAX_ATTEMPTS
	});

	// Initial recovery of anything orphaned by the previous process, then poll.
	void reclaimStaleRunning().catch((e) => log.error('initial reclaim failed', e));

	// Kick the adaptive poll loop (self-scheduling) + the periodic stale reclaim.
	scheduleNext(0);
	reclaimTimer = setInterval(
		() => void reclaimStaleRunning().catch((e) => log.error('reclaim sweep failed', e)),
		RECLAIM_INTERVAL_MS
	);

	// Don't keep the event loop alive solely for the reclaim timer.
	reclaimTimer.unref?.();
}

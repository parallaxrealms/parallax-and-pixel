import type { RequestHandler } from './$types';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';
import { createLogger } from '$lib/server/logger';

const log = createLogger('webhooks/resend');

/**
 * POST /api/webhooks/resend — receive Resend (Svix-signed) email events and
 * upsert them into public.email_logs. Public route, but every request is
 * verified against RESEND_WEBHOOK_SECRET; unsigned/forged calls are rejected.
 *
 * No CSRF concern: Resend sends application/json (SvelteKit's CSRF guard only
 * blocks cross-origin form content-types).
 */

/** Verify a Svix signature (Resend's webhook signing scheme). */
function verifySvix(rawBody: string, headers: Headers, secret: string): boolean {
	const id = headers.get('svix-id');
	const ts = headers.get('svix-timestamp');
	const sig = headers.get('svix-signature');
	if (!id || !ts || !sig) return false;

	// Reject stale timestamps (replay protection, 5-min tolerance).
	const tsNum = Number(ts);
	if (!Number.isFinite(tsNum)) return false;
	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - tsNum) > 300) return false;

	// Secret is "whsec_<base64>"; the bytes after the prefix are the HMAC key.
	const keyBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
	const expected = createHmac('sha256', keyBytes).update(`${id}.${ts}.${rawBody}`).digest('base64');
	const expectedBuf = Buffer.from(expected);

	// svix-signature is space-separated "v1,<base64>" entries — match any.
	return sig.split(' ').some((entry) => {
		const value = entry.split(',')[1];
		if (!value) return false;
		const vb = Buffer.from(value);
		return vb.length === expectedBuf.length && timingSafeEqual(vb, expectedBuf);
	});
}

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.RESEND_WEBHOOK_SECRET;
	const raw = await request.text();

	if (!secret) {
		log.error('RESEND_WEBHOOK_SECRET not configured');
		return new Response('webhook not configured', { status: 500 });
	}
	if (!verifySvix(raw, request.headers, secret)) {
		return new Response('invalid signature', { status: 401 });
	}

	let evt: { type?: string; created_at?: string; data?: Record<string, unknown> };
	try {
		evt = JSON.parse(raw);
	} catch {
		return new Response('bad payload', { status: 400 });
	}

	const type = evt.type ?? '';
	const d = (evt.data ?? {}) as Record<string, unknown>;
	const emailId = (d.email_id as string) ?? (d.id as string) ?? '';
	// Non-email events (contact.*, domain.*) carry no email id — ack and ignore.
	if (!type.startsWith('email.') || !emailId) {
		return new Response('ok', { status: 200 });
	}

	const eventAt = evt.created_at ?? new Date().toISOString();
	const nowIso = new Date().toISOString();
	const toField = d.to;
	const toAddr = Array.isArray(toField) ? toField.join(', ') : ((toField as string) ?? null);

	const row: Record<string, unknown> = {
		email_id: emailId,
		from_addr: (d.from as string) ?? null,
		to_addr: toAddr,
		subject: (d.subject as string) ?? null,
		status: type.replace(/^email\./, ''),
		last_event: type,
		last_event_at: eventAt,
		updated_at: nowIso,
		raw: evt
	};

	// Per-status timestamps / error detail. Columns NOT set here are preserved on
	// upsert, so each event enriches the row without clobbering earlier stamps.
	if (type === 'email.sent') row.sent_at = eventAt;
	else if (type === 'email.delivered') row.delivered_at = eventAt;
	else if (type === 'email.delivery_delayed') row.last_event_at = eventAt;
	else if (type === 'email.bounced') {
		row.bounced_at = eventAt;
		const bounce = d.bounce as { message?: string } | undefined;
		row.error = bounce?.message ?? (d.reason as string) ?? null;
	} else if (type === 'email.complained') row.complained_at = eventAt;
	else if (type === 'email.failed') {
		const failed = d.failed as { reason?: string } | undefined;
		row.error = failed?.reason ?? (d.reason as string) ?? null;
	}

	const admin = getSupabaseAdmin();
	const { error } = await admin.from('email_logs').upsert(row, { onConflict: 'email_id' });
	if (error) {
		log.error('email_logs upsert failed', { emailId, type, err: error.message });
		// Still 200 so Resend doesn't retry-storm on a transient DB issue we logged.
	}

	return new Response('ok', { status: 200 });
};

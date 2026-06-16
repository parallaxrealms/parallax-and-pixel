/**
 * Streams a stored audit PDF back through the app, so the browser only ever
 * sees a parallaxandpixel.com URL — the Supabase Storage host, bucket layout, and
 * signed-URL token never leave the server.
 *
 * Used by both PDF routes:
 *   - /audit/[id]/report.pdf  (session-gated, dashboard)
 *   - /r/[token]              (token-gated, emailed link)
 *
 * The private bucket is read with the service-role admin client and the bytes
 * are piped back. No signed URL is minted.
 */

import { getSupabaseAdmin } from '$lib/server/supabaseAdmin';
import { createLogger } from '$lib/server/logger';
import { AUDIT_BUCKET } from './deliver';
import { pdfFilename, hostnameOf } from './model';

const log = createLogger('audit/pdf/serve');

export interface ServePdfInput {
	/** Storage object path, e.g. "{user_id}/{audit_id}.pdf". */
	storageKey: string;
	/** Audited site URL — used to build the friendly download filename. */
	url: string;
	/** Audit completion/creation timestamp — dates the filename. */
	datedAt: string;
	/** true → Content-Disposition: attachment; false → inline (view in tab). */
	download: boolean;
}

/**
 * Returns a 200 Response with the PDF bytes, or null if the object is missing
 * from storage (e.g. aged out by retention). Callers turn null into a 404.
 */
export async function streamAuditPdf(input: ServePdfInput): Promise<Response | null> {
	const admin = getSupabaseAdmin();
	const { data: blob, error } = await admin.storage.from(AUDIT_BUCKET).download(input.storageKey);

	if (error || !blob) {
		log.warn('pdf download from storage failed', {
			storageKey: input.storageKey,
			err: error?.message ?? 'no blob'
		});
		return null;
	}

	const bytes = new Uint8Array(await blob.arrayBuffer());
	const filename = pdfFilename(hostnameOf(input.url), new Date(input.datedAt).toISOString().slice(0, 10));
	const disposition = input.download ? 'attachment' : 'inline';

	return new Response(bytes, {
		status: 200,
		headers: {
			'content-type': 'application/pdf',
			'content-length': String(bytes.byteLength),
			'content-disposition': `${disposition}; filename="${filename}"`,
			// Private + revalidate: these URLs gate on session/token, so never let
			// a shared cache hold the bytes.
			'cache-control': 'private, no-store'
		}
	});
}

/**
 * Cheap network probes. Ported VERBATIM from 9realms'
 * `scoring/signals/probes.ts` for signal parity. Used for:
 *   - llms.txt existence
 *   - robots.txt existence
 *   - sitemap.xml existence
 *   - TLS certificate validity + expiry
 *
 * All probes run in parallel. Each has a short timeout so a slow origin
 * doesn't block the whole pipeline. No credit cost (we call the origin
 * directly).
 */

import tls from 'node:tls';
import { URL } from 'node:url';
import type { AiReadinessSignals, TlsSignals } from '../types';

const PROBE_TIMEOUT_MS = 5_000;

export interface ProbeResult {
	aiReadinessPartial: Pick<AiReadinessSignals, 'llms_txt' | 'robots_txt' | 'sitemap_xml'>;
	tls: TlsSignals;
	errors: string[];
}

export async function runProbes(url: string): Promise<ProbeResult> {
	const errors: string[] = [];
	const origin = safeOrigin(url);
	if (!origin) {
		return {
			aiReadinessPartial: { llms_txt: false, robots_txt: false, sitemap_xml: false },
			tls: { valid: false, issuer: null, expires_at: null, days_until_expiry: null },
			errors: ['invalid URL']
		};
	}

	const [llms, robots, sitemap, tlsInfo] = await Promise.all([
		probeExists(`${origin}/llms.txt`).catch((e) => {
			errors.push(`llms.txt: ${e.message}`);
			return false;
		}),
		probeExists(`${origin}/robots.txt`).catch((e) => {
			errors.push(`robots.txt: ${e.message}`);
			return false;
		}),
		probeExists(`${origin}/sitemap.xml`).catch((e) => {
			errors.push(`sitemap.xml: ${e.message}`);
			return false;
		}),
		probeTls(origin).catch((e) => {
			errors.push(`tls: ${e.message}`);
			return { valid: false, issuer: null, expires_at: null, days_until_expiry: null };
		})
	]);

	return {
		aiReadinessPartial: {
			llms_txt: llms,
			robots_txt: robots,
			sitemap_xml: sitemap
		},
		tls: tlsInfo,
		errors
	};
}

function safeOrigin(url: string): string | null {
	try {
		const u = new URL(url);
		return `${u.protocol}//${u.host}`;
	} catch {
		return null;
	}
}

/** HEAD (fallback GET) with a short timeout. Returns true on 2xx. */
async function probeExists(url: string): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
	try {
		// Try HEAD first — many servers reject HEAD; fall back to GET on 405/5xx.
		let r = await fetch(url, {
			method: 'HEAD',
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'User-Agent': 'PxpAudit/0.1 (+https://parallaxandpixel.com)' }
		});
		if (!r.ok && (r.status === 405 || r.status >= 500)) {
			r = await fetch(url, {
				method: 'GET',
				redirect: 'follow',
				signal: controller.signal,
				headers: { 'User-Agent': 'PxpAudit/0.1 (+https://parallaxandpixel.com)' }
			});
		}
		return r.ok;
	} finally {
		clearTimeout(timer);
	}
}

function probeTls(origin: string): Promise<TlsSignals> {
	return new Promise((resolve, reject) => {
		let u: URL;
		try {
			u = new URL(origin);
		} catch {
			return reject(new Error('invalid origin'));
		}
		if (u.protocol !== 'https:') {
			return resolve({ valid: false, issuer: null, expires_at: null, days_until_expiry: null });
		}

		const port = u.port ? Number(u.port) : 443;
		const socket = tls.connect(
			{
				host: u.hostname,
				port,
				servername: u.hostname,
				timeout: PROBE_TIMEOUT_MS,
				rejectUnauthorized: false
			},
			() => {
				const cert = socket.getPeerCertificate();
				const authorized = socket.authorized;
				if (!cert || Object.keys(cert).length === 0) {
					socket.end();
					return resolve({
						valid: false,
						issuer: null,
						expires_at: null,
						days_until_expiry: null
					});
				}
				const expiresAt = cert.valid_to ? new Date(cert.valid_to) : null;
				const daysUntil =
					expiresAt !== null
						? Math.round((expiresAt.getTime() - Date.now()) / 86_400_000)
						: null;
				socket.end();
				resolve({
					valid: authorized,
					issuer: cert.issuer?.O ?? cert.issuer?.CN ?? null,
					expires_at: expiresAt?.toISOString() ?? null,
					days_until_expiry: daysUntil
				});
			}
		);
		socket.on('error', (err) => {
			socket.destroy();
			reject(err);
		});
		socket.on('timeout', () => {
			socket.destroy();
			reject(new Error('tls probe timeout'));
		});
	});
}

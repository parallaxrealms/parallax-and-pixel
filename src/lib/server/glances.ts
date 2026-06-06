import { env } from '$env/dynamic/private';

/**
 * Server-side Glances REST API client. Ported from 9realms (ODIN).
 *
 * Each tracked server has a Glances instance running on it (port 61208 by
 * default, fronted by Coolify/Traefik with TLS + basic auth). The site's
 * backend pulls snapshots and the browser polls this app — Glances credentials
 * never reach the browser.
 *
 * Env vars:
 *   GLANCES_USERNAME       — basic-auth user (shared across servers)
 *   GLANCES_PASSWORD       — basic-auth password (shared across servers)
 *   GLANCES_YGG_URL        — full base URL e.g. https://stats.ygg.yggdrasil.quest:61208
 *   GLANCES_MIDGARD_URL    — full base URL e.g. https://stats.drasil.yggdrasil.quest:61208
 *   GLANCES_HEL1_URL       — full base URL for the Bifrost daemon host
 *
 * Add more servers by adding GLANCES_<ID>_URL.
 */

export interface GlancesSnapshot {
	cpu: { total: number | null };
	mem: { percent: number | null; total: number | null; used: number | null };
	fs: { mnt_point: string; percent: number | null; size: number | null; used: number | null }[];
	load: { min1: number | null; min5: number | null; min15: number | null; cpucore: number | null };
	network: {
		interface_name: string;
		bytes_recv_rate_per_sec: number | null;
		bytes_sent_rate_per_sec: number | null;
	}[];
	diskio: {
		disk_name: string;
		read_bytes_rate_per_sec: number | null;
		write_bytes_rate_per_sec: number | null;
	}[];
	uptime: string | null;
	uptime_seconds: number | null;
	now: string | null;
}

function getServerUrl(serverId: string): string | null {
	const key = `GLANCES_${serverId.toUpperCase()}_URL` as const;
	const url = (env as Record<string, string | undefined>)[key]?.trim();
	return url ? url.replace(/\/+$/, '') : null;
}

function authHeader(): string | null {
	const user = env.GLANCES_USERNAME?.trim();
	const pass = env.GLANCES_PASSWORD?.trim();
	if (!user || !pass) return null;
	return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

export function isGlancesConfigured(serverId: string): boolean {
	return Boolean(getServerUrl(serverId));
}

function parseUptimeSeconds(uptime: unknown): number | null {
	if (typeof uptime === 'number' && isFinite(uptime)) return uptime;
	if (typeof uptime !== 'string') return null;
	// Glances returns strings like "5 days, 3:42:10" or "3:42:10"
	const m = uptime.match(/(?:(\d+)\s*days?,\s*)?(\d+):(\d+):(\d+)/);
	if (!m) return null;
	const [, d, h, mm, s] = m;
	return Number(d ?? 0) * 86400 + Number(h) * 3600 + Number(mm) * 60 + Number(s);
}

function num(v: unknown): number | null {
	return typeof v === 'number' && isFinite(v) ? v : null;
}

/**
 * Turn a thrown fetch error into a human-readable reason. Node's fetch reports
 * transport failures as a generic "fetch failed" with the real cause nested in
 * `error.cause.code`, so we unwrap it and map the common codes to plain English
 * (untrusted cert, DNS, refused, timeout). This message flows through the route's
 * 502 body into the Telemetry tab so failures explain themselves.
 */
function describeFetchError(err: unknown): string {
	const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
	const code = cause?.code;
	switch (code) {
		case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
		case 'SELF_SIGNED_CERT_IN_CHAIN':
		case 'DEPTH_ZERO_SELF_SIGNED_CERT':
		case 'SELF_SIGNED_CERT':
			return 'TLS certificate not trusted (self-signed or default cert — check Traefik/Let’s Encrypt)';
		case 'ERR_TLS_CERT_ALTNAME_INVALID':
			return 'TLS certificate does not match the hostname';
		case 'CERT_HAS_EXPIRED':
			return 'TLS certificate has expired';
		case 'ENOTFOUND':
		case 'EAI_AGAIN':
			return 'DNS lookup failed (host not found)';
		case 'ECONNREFUSED':
			return 'Connection refused (Glances not listening / wrong port)';
		case 'ECONNRESET':
			return 'Connection reset by peer';
		case 'ETIMEDOUT':
		case 'UND_ERR_CONNECT_TIMEOUT':
		case 'UND_ERR_HEADERS_TIMEOUT':
			return 'Request timed out (host unreachable or slow)';
	}
	if (err instanceof Error && err.name === 'TimeoutError') return 'Request timed out';
	const detail = cause?.message ?? (err instanceof Error ? err.message : String(err));
	return code ? `${code}: ${detail}` : detail;
}

/** Best-effort plain-English label for an HTTP status from the Glances proxy. */
function describeHttpStatus(status: number, statusText: string): string {
	const hint =
		status === 401 || status === 403
			? ' (check GLANCES_USERNAME / GLANCES_PASSWORD)'
			: status === 502 || status === 503 || status === 504
				? ' (Glances backend not reachable behind the proxy)'
				: status === 404
					? ' (wrong path — expected /api/4/all)'
					: '';
	return `HTTP ${status}${statusText ? ` ${statusText}` : ''}${hint}`;
}

/**
 * Shared GET against a server's Glances `/api/4/all` plugin. Applies basic-auth,
 * an 8s timeout, and maps transport/HTTP failures to the same human-readable
 * reasons the Telemetry tab surfaces. Returns the parsed JSON object.
 */
async function fetchGlancesAll(
	serverId: string,
	signal?: AbortSignal
): Promise<Record<string, unknown>> {
	const base = getServerUrl(serverId);
	if (!base) throw new Error(`No GLANCES_${serverId.toUpperCase()}_URL configured`);
	const auth = authHeader();

	const headers: Record<string, string> = { Accept: 'application/json' };
	if (auth) headers.Authorization = auth;

	// Bound the request so a hung connection (e.g. stalled TLS handshake) fails
	// fast with a clear reason instead of blocking the polling loop.
	const timeout = AbortSignal.timeout(8000);
	const reqSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

	let res: Response;
	try {
		res = await fetch(`${base}/api/4/all`, { headers, signal: reqSignal });
	} catch (err) {
		throw new Error(`${serverId}: ${describeFetchError(err)}`);
	}
	if (!res.ok) {
		throw new Error(`${serverId}: ${describeHttpStatus(res.status, res.statusText)}`);
	}
	return (await res.json()) as Record<string, unknown>;
}

export async function fetchGlancesSnapshot(
	serverId: string,
	signal?: AbortSignal
): Promise<GlancesSnapshot> {
	const raw = await fetchGlancesAll(serverId, signal);

	const cpu = (raw.cpu ?? {}) as Record<string, unknown>;
	const mem = (raw.mem ?? {}) as Record<string, unknown>;
	const load = (raw.load ?? {}) as Record<string, unknown>;
	const fs = (Array.isArray(raw.fs) ? raw.fs : []) as Record<string, unknown>[];
	const network = (Array.isArray(raw.network) ? raw.network : []) as Record<string, unknown>[];
	const diskio = (Array.isArray(raw.diskio) ? raw.diskio : []) as Record<string, unknown>[];

	return {
		cpu: { total: num(cpu.total) },
		mem: {
			percent: num(mem.percent),
			total: num(mem.total),
			used: num(mem.used)
		},
		fs: fs.map((f) => ({
			mnt_point: String(f.mnt_point ?? '?'),
			percent: num(f.percent),
			size: num(f.size),
			used: num(f.used)
		})),
		load: {
			min1: num(load.min1),
			min5: num(load.min5),
			min15: num(load.min15),
			cpucore: num(load.cpucore)
		},
		network: network.map((n) => ({
			interface_name: String(n.interface_name ?? n.alias ?? '?'),
			bytes_recv_rate_per_sec:
				num(n.bytes_recv_rate_per_sec) ?? num(n.bytes_recv_rate_per_sec_gauge) ?? num(n.rx),
			bytes_sent_rate_per_sec:
				num(n.bytes_sent_rate_per_sec) ?? num(n.bytes_sent_rate_per_sec_gauge) ?? num(n.tx)
		})),
		diskio: diskio.map((d) => ({
			disk_name: String(d.disk_name ?? '?'),
			read_bytes_rate_per_sec:
				num(d.read_bytes_rate_per_sec) ?? num(d.read_bytes_rate_per_sec_gauge),
			write_bytes_rate_per_sec:
				num(d.write_bytes_rate_per_sec) ?? num(d.write_bytes_rate_per_sec_gauge)
		})),
		uptime: typeof raw.uptime === 'string' ? raw.uptime : null,
		uptime_seconds: parseUptimeSeconds(raw.uptime),
		now: typeof raw.now === 'string' ? raw.now : new Date().toISOString()
	};
}

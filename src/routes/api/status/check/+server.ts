// GET /api/status/check - Check health of all external services

import { json, type RequestHandler } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { SERVICE_REGISTRY, type ServiceConfig, type ServiceHealth, type ServiceStatus } from '$lib/types/service-status';
import { requireAdmin } from '$lib/server/admin-guard';

// `$env/dynamic/private` intentionally EXCLUDES PUBLIC_-prefixed vars, so a
// service whose `requiresEnv` names a PUBLIC_ var (e.g. PUBLIC_BIFROST_DAEMON_URL)
// would always read undefined here and be reported 'unknown'. Merge both scopes
// (they're disjoint) so credential checks can gate on either.
const env: Record<string, string | undefined> = { ...publicEnv, ...privateEnv };

const TIMEOUT_MS = 5000;

function mapIndicator(indicator: string): ServiceHealth {
	switch (indicator) {
		case 'none':
			return 'operational';
		case 'minor':
			return 'degraded';
		case 'major':
		case 'critical':
			return 'down';
		default:
			return 'unknown';
	}
}

function mapComponentStatus(status: string): ServiceHealth {
	switch (status) {
		case 'operational':
			return 'operational';
		case 'degraded_performance':
		case 'partial_outage':
			return 'degraded';
		case 'major_outage':
			return 'down';
		default:
			return 'unknown';
	}
}

async function fetchWithTimeout(
	url: string,
	timeoutMs: number,
	headers?: Record<string, string>
): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': 'PxP-StatusCheck/1.0', ...headers }
		});
		return res;
	} finally {
		clearTimeout(timeout);
	}
}

/** Basic-auth header value from a "user:pass" pair. */
function basicAuth(user: string, pass: string): string {
	return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

/**
 * Authenticated health check against a service's own API.
 * - missing requiresEnv → 'unknown' (unconfigured, not broken)
 * - res.ok → 'operational'
 * - 401/403 → 'degraded' (reachable but creds bad)
 * - other non-ok → 'degraded'
 * - thrown/abort → 'down'
 */
async function checkCredential(config: ServiceConfig): Promise<ServiceStatus> {
	const now = () => new Date().toISOString();

	const unknown = (): ServiceStatus => ({
		id: config.id,
		name: config.name,
		status: 'unknown',
		url: config.statusUrl,
		lastChecked: now()
	});

	// Gate on required env vars.
	if (config.requiresEnv?.some((key) => !env[key])) {
		return unknown();
	}

	// Read a guaranteed-present env var (guarded by requiresEnv above).
	const v = (key: string): string => env[key] ?? '';

	// Build the per-service request (URL + headers).
	let url: string;
	const linkUrl = config.statusUrl;
	const headers: Record<string, string> = {};

	switch (config.id) {
		case 'firecrawl':
			url = 'https://api.firecrawl.dev/v1/team/credit-usage';
			headers['Authorization'] = `Bearer ${v('FIRECRAWL_API_KEY')}`;
			break;
		case 'prometheus':
			url = `${v('PROMETHEUS_URL')}/-/healthy`;
			if (env.PROMETHEUS_BEARER) {
				headers['Authorization'] = `Bearer ${env.PROMETHEUS_BEARER}`;
			} else if (env.PROMETHEUS_BASIC_AUTH) {
				headers['Authorization'] =
					'Basic ' + Buffer.from(env.PROMETHEUS_BASIC_AUTH).toString('base64');
			}
			break;
		case 'glances-ygg':
			url = `${v('GLANCES_YGG_URL')}/api/4/status`;
			headers['Authorization'] = basicAuth(v('GLANCES_USERNAME'), v('GLANCES_PASSWORD'));
			break;
		case 'glances-midgard':
			url = `${v('GLANCES_MIDGARD_URL')}/api/4/status`;
			headers['Authorization'] = basicAuth(v('GLANCES_USERNAME'), v('GLANCES_PASSWORD'));
			break;
		case 'glances-hel1':
			url = `${v('GLANCES_HEL1_URL')}/api/4/status`;
			headers['Authorization'] = basicAuth(v('GLANCES_USERNAME'), v('GLANCES_PASSWORD'));
			break;
		case 'bifrost-daemon': {
			const daemonUrl = env.PUBLIC_BIFROST_DAEMON_URL;
			// Treat 'mock'/empty as not-configured.
			if (!daemonUrl || daemonUrl === 'mock') {
				return unknown();
			}
			url = `${daemonUrl}/health`;
			break;
		}
		default:
			// No request builder for this id — can't check it.
			return unknown();
	}

	const start = Date.now();
	try {
		const res = await fetchWithTimeout(url, TIMEOUT_MS, headers);
		const responseTime = Date.now() - start;

		let status: ServiceHealth;
		if (res.ok) {
			status = 'operational';
		} else if (res.status === 401 || res.status === 403) {
			// Reachable but credentials rejected.
			status = 'degraded';
		} else {
			status = 'degraded';
		}

		return {
			id: config.id,
			name: config.name,
			status,
			url: linkUrl,
			lastChecked: now(),
			responseTime
		};
	} catch {
		return {
			id: config.id,
			name: config.name,
			status: 'down',
			url: linkUrl,
			lastChecked: now()
		};
	}
}

async function checkStatusApi(config: ServiceConfig): Promise<ServiceStatus> {
	const start = Date.now();
	try {
		const res = await fetchWithTimeout(config.checkUrl, TIMEOUT_MS);
		const responseTime = Date.now() - start;
		const data = await res.json();

		const status = mapIndicator(data.status?.indicator || 'unknown');

		// Fetch component-level status if children are defined
		let children: ServiceStatus[] | undefined;
		if (config.children && config.children.length > 0) {
			try {
				const componentsUrl = config.checkUrl.replace('/status.json', '/components.json');
				const compRes = await fetchWithTimeout(componentsUrl, TIMEOUT_MS);
				const compData = await compRes.json();
				const components = compData.components || [];

				children = config.children.map((child) => {
					const match = components.find(
						(c: { name: string; status: string }) =>
							child.componentName &&
							c.name.toLowerCase().includes(child.componentName.toLowerCase())
					);
					return {
						id: child.id,
						name: child.name,
						status: match ? mapComponentStatus(match.status) : status,
						lastChecked: new Date().toISOString()
					};
				});
			} catch {
				// If components fetch fails, children inherit parent status
				children = config.children.map((child) => ({
					id: child.id,
					name: child.name,
					status,
					lastChecked: new Date().toISOString()
				}));
			}
		}

		return {
			id: config.id,
			name: config.name,
			status,
			url: config.statusUrl,
			lastChecked: new Date().toISOString(),
			responseTime,
			children
		};
	} catch {
		return {
			id: config.id,
			name: config.name,
			status: 'down',
			url: config.statusUrl,
			lastChecked: new Date().toISOString(),
			children: config.children?.map((child) => ({
				id: child.id,
				name: child.name,
				status: 'down' as ServiceHealth,
				lastChecked: new Date().toISOString()
			}))
		};
	}
}

async function checkHttpPing(config: ServiceConfig): Promise<ServiceStatus> {
	const start = Date.now();
	try {
		const res = await fetchWithTimeout(config.checkUrl, TIMEOUT_MS);
		const responseTime = Date.now() - start;

		let status: ServiceHealth;
		if (res.ok) {
			status = 'operational';
		} else if (res.status >= 500) {
			status = 'degraded';
		} else {
			// 3xx, 4xx — service is reachable
			status = 'operational';
		}

		return {
			id: config.id,
			name: config.name,
			status,
			url: config.statusUrl,
			lastChecked: new Date().toISOString(),
			responseTime,
			children: config.children?.map((child) => ({
				id: child.id,
				name: child.name,
				status,
				lastChecked: new Date().toISOString()
			}))
		};
	} catch {
		return {
			id: config.id,
			name: config.name,
			status: 'down',
			url: config.statusUrl,
			lastChecked: new Date().toISOString(),
			children: config.children?.map((child) => ({
				id: child.id,
				name: child.name,
				status: 'down' as ServiceHealth,
				lastChecked: new Date().toISOString()
			}))
		};
	}
}

async function checkService(config: ServiceConfig): Promise<ServiceStatus> {
	if (config.checkType === 'status-api') {
		return checkStatusApi(config);
	}
	if (config.checkType === 'credential-check') {
		return checkCredential(config);
	}
	return checkHttpPing(config);
}

export const GET: RequestHandler = async ({ locals }) => {
	const denied = await requireAdmin(locals);
	if (denied) return denied;

	const results = await Promise.allSettled(SERVICE_REGISTRY.map(checkService));

	const services: ServiceStatus[] = results.map((result, i) => {
		if (result.status === 'fulfilled') {
			return result.value;
		}
		return {
			id: SERVICE_REGISTRY[i].id,
			name: SERVICE_REGISTRY[i].name,
			status: 'unknown' as ServiceHealth,
			lastChecked: new Date().toISOString()
		};
	});

	return json(
		{ services, checkedAt: new Date().toISOString() },
		{
			headers: {
				'Cache-Control': 'max-age=30'
			}
		}
	);
};

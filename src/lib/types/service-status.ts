// Service Status Types & Configuration

export type ServiceHealth = 'operational' | 'degraded' | 'down' | 'unknown';

export interface ServiceStatus {
	id: string;
	name: string;
	status: ServiceHealth;
	url?: string;
	lastChecked: string;
	responseTime?: number;
	children?: ServiceStatus[];
}

export interface ServiceConfig {
	id: string;
	name: string;
	checkType: 'status-api' | 'http-ping' | 'credential-check';
	checkUrl: string;
	statusUrl?: string;
	/**
	 * Env var names that must ALL be present for a credential-check to run.
	 * If any is missing, the service reports status 'unknown' (not 'down'),
	 * so unconfigured services don't appear broken.
	 */
	requiresEnv?: string[];
	children?: { id: string; name: string; componentName?: string }[];
}

/**
 * Registry of all external services to monitor.
 * - status-api: Atlassian Statuspage JSON API (GitHub, Stripe, etc.)
 * - http-ping: Simple HTTP GET with timeout
 * - credential-check: Authenticated request to a service's own API using
 *   server-side secrets; requiresEnv gates the check (missing → 'unknown').
 */
// Edit this list to add/remove monitored services.
export const SERVICE_REGISTRY: ServiceConfig[] = [
	{
		id: 'parallax-and-pixel',
		name: 'Parallax & Pixel',
		checkType: 'http-ping',
		checkUrl: 'https://parallaxandpixel.com',
		statusUrl: 'https://parallaxandpixel.com'
	},
	{
		id: 'dialup-dungeon',
		name: 'DialUp Dungeon',
		checkType: 'http-ping',
		checkUrl: 'https://dialupdungeon.com',
		statusUrl: 'https://dialupdungeon.com'
	},
	{
		id: 'bifrost-daemon',
		name: 'Bifrost Daemon',
		checkType: 'credential-check',
		checkUrl: 'bifrost-daemon',
		requiresEnv: ['PUBLIC_BIFROST_DAEMON_URL']
	},
	{
		id: 'supabase',
		name: 'Supabase',
		checkType: 'status-api',
		checkUrl: 'https://status.supabase.com/api/v2/status.json',
		statusUrl: 'https://status.supabase.com',
		children: [
			{ id: 'supabase-db', name: 'Database', componentName: 'Database' },
			{ id: 'supabase-auth', name: 'Auth', componentName: 'Auth' },
			{ id: 'supabase-realtime', name: 'Realtime', componentName: 'Realtime' },
			{ id: 'supabase-storage', name: 'Storage', componentName: 'Storage' }
		]
	},
	{
		id: 'stripe',
		name: 'Stripe',
		checkType: 'http-ping',
		checkUrl: 'https://status.stripe.com',
		statusUrl: 'https://status.stripe.com'
	},
	{
		id: 'resend',
		name: 'Resend',
		checkType: 'status-api',
		checkUrl: 'https://resend-status.com/api/v2/status.json',
		statusUrl: 'https://resend-status.com'
	},
	{
		id: 'firecrawl',
		name: 'Firecrawl',
		checkType: 'credential-check',
		checkUrl: 'https://api.firecrawl.dev/v1/team/credit-usage',
		statusUrl: 'https://www.firecrawl.dev',
		requiresEnv: ['FIRECRAWL_API_KEY']
	},
	{
		id: 'anthropic',
		name: 'Anthropic',
		checkType: 'status-api',
		checkUrl: 'https://status.anthropic.com/api/v2/status.json',
		statusUrl: 'https://status.anthropic.com'
	},
	{
		id: 'openrouter',
		name: 'OpenRouter',
		checkType: 'http-ping',
		checkUrl: 'https://openrouter.ai',
		statusUrl: 'https://openrouter.ai'
	},
	{
		id: 'github',
		name: 'GitHub',
		checkType: 'status-api',
		checkUrl: 'https://www.githubstatus.com/api/v2/status.json',
		statusUrl: 'https://www.githubstatus.com',
		children: [
			{ id: 'github-actions', name: 'Actions', componentName: 'Actions' },
			{ id: 'github-packages', name: 'Packages', componentName: 'Packages' },
			{ id: 'github-api', name: 'API', componentName: 'API Requests' }
		]
	},
	{
		id: 'hetzner',
		name: 'Hetzner',
		checkType: 'http-ping',
		checkUrl: 'https://status.hetzner.com',
		statusUrl: 'https://status.hetzner.com'
	},
	{
		id: 'coolify',
		name: 'Coolify',
		checkType: 'http-ping',
		checkUrl: 'https://app.coolify.io'
	},
	{
		id: 'prometheus',
		name: 'Prometheus',
		checkType: 'credential-check',
		checkUrl: 'prometheus',
		requiresEnv: ['PROMETHEUS_URL']
	},
	{
		id: 'glances-ygg',
		name: 'Glances (YGG)',
		checkType: 'credential-check',
		checkUrl: 'glances-ygg',
		requiresEnv: ['GLANCES_YGG_URL', 'GLANCES_USERNAME', 'GLANCES_PASSWORD']
	},
	{
		id: 'glances-midgard',
		name: 'Glances (MIDGARD)',
		checkType: 'credential-check',
		checkUrl: 'glances-midgard',
		requiresEnv: ['GLANCES_MIDGARD_URL', 'GLANCES_USERNAME', 'GLANCES_PASSWORD']
	},
	{
		id: 'glances-hel1',
		name: 'Glances (HEL1)',
		checkType: 'credential-check',
		checkUrl: 'glances-hel1',
		requiresEnv: ['GLANCES_HEL1_URL', 'GLANCES_USERNAME', 'GLANCES_PASSWORD']
	}
];

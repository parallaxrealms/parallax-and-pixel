import type { SceneDoc } from '../schema';

// Group colors (blueprint-adjacent spectrum).
const C = {
	frontend: '#f5a623',
	backend: '#3b82f6',
	data: '#14b8a6',
	security: '#22c55e',
	infra: '#94a3b8',
	agents: '#a855f7',
	cicd: '#eab308',
	payments: '#38bdf8',
	observe: '#ef4444'
};

/**
 * The 9realms system as a node graph — the proving scene for the Graph primitive
 * (native 2D renderer + dagre layout). Nodes are the real services/hosts; edges
 * are the real relationships (deploys-to / hosts / talks-to / queries).
 */
export const nineRealmsArchitectureScene: SceneDoc = {
	id: '9realms-architecture',
	slug: '9realms-architecture',
	name: '9realms — System Architecture',
	description: 'Services, hosts, and how they talk to each other.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		nodes: [
			{ id: 'github', label: 'GitHub', group: 'CI/CD', color: C.cicd, panel: '**Source of truth + deploy trigger.**\n\n- HTTPS auth (Windows credential manager)\n- pnpm workspace; `@parallaxrealms/*` → GitHub Packages\n- Push → Coolify redeploys' },
			{ id: 'coolify', label: 'Coolify', group: 'Infra', color: C.infra, panel: '**Self-hosted PaaS** on midgard. Watches GitHub, builds the container (`adapter-node`), runs Traefik + ACME in front.' },
			{ id: 'midgard', label: 'midgard VPS', group: 'Infra', color: C.infra, panel: '**Hetzner production box** (formerly "drasil"). Hosts the 9realms dashboard + satoridigital.io via Coolify.' },
			{ id: 'dashboard', label: '9realms Dashboard', group: 'Frontend', color: C.frontend, panel: '**The SvelteKit 5 app** — nine modes behind a `[mode]` route. Tailwind 4, shadcn, three.js (Yggdrasil + DAEDALUS).' },
			{ id: 'api', label: 'API & Server Routes', group: 'Backend', color: C.backend, panel: '**SvelteKit server routes / form actions** + the `@parallaxrealms/api-*` factory-handler packages. Server-side adapters keep secrets off the client.' },
			{ id: 'auth', label: 'Auth & RLS', group: 'Security', color: C.security, panel: '**Supabase Auth** (magic-link + OAuth) + **Row-Level Security**, team roles, a `hooks.server.ts` guard.' },
			{ id: 'supabase', label: 'Supabase / Postgres', group: 'Data', color: C.data, panel: '**System of record** — the `nine` schema (renamed from `odin`). Multi-tenant via `site_id`; cache-first JSON loading.' },
			{ id: 'storage', label: 'Supabase Storage', group: 'Data', color: C.data, panel: '**Object storage** — the `9realms` bucket for media/assets.' },
			{ id: 'bifrost', label: 'Bifrost Daemon', group: 'Agents', color: C.agents, panel: '**The agent substrate** — hosts the realm-agents. Reached from the dashboard over `/api/bifrost/*` (BIFROST mode + Discord).', link: { sceneId: 'bifrost-client', label: 'Open Bifrost client' } },
			{ id: 'satori', label: 'Satori Agent', group: 'Agents', color: C.agents, panel: '**The live agent** (PM / briefer). Model tier ladder FREE → HAIKU → SONNET → OPUS, budget-aware.' },
			{ id: 'hel1', label: 'satori-daemon-hel1', group: 'Infra', color: C.infra, panel: '**Hetzner CPX32** hosting the autonomous agents. Tailscale mesh to midgard. Distinct from the production web box.' },
			{ id: 'stripe', label: 'Stripe / Square', group: 'Payments', color: C.payments, panel: '**Dual-path payments** (intentionally leaky abstraction). Invoices, checkout, subscriptions.' },
			{ id: 'otel', label: 'ygg-otel / Glances', group: 'Observability', color: C.observe, panel: '**Observability** — OpenTelemetry spans+metrics + per-host Glances, surfaced in the HEIMDALL mode.' }
		],
		groups: [
			{ id: 'Frontend', label: 'Frontend', color: C.frontend },
			{ id: 'Backend', label: 'Backend', color: C.backend },
			{ id: 'Data', label: 'Data', color: C.data },
			{ id: 'Security', label: 'Security', color: C.security },
			{ id: 'Infra', label: 'Infra', color: C.infra },
			{ id: 'Agents', label: 'Agents', color: C.agents },
			{ id: 'CI/CD', label: 'CI/CD', color: C.cicd },
			{ id: 'Payments', label: 'Payments', color: C.payments },
			{ id: 'Observability', label: 'Observability', color: C.observe }
		],
		edges: [
			{ source: 'github', target: 'coolify', kind: 'event', label: 'push' },
			{ source: 'coolify', target: 'midgard', kind: 'dep', label: 'deploys' },
			{ source: 'midgard', target: 'dashboard', kind: 'dep', label: 'hosts' },
			{ source: 'dashboard', target: 'api', kind: 'sync', label: 'calls' },
			{ source: 'api', target: 'auth', kind: 'sync', label: 'validates' },
			{ source: 'api', target: 'supabase', kind: 'data', label: 'SQL', animated: true },
			{ source: 'api', target: 'storage', kind: 'data', label: 'objects' },
			{ source: 'auth', target: 'supabase', kind: 'data', label: 'RLS' },
			{ source: 'dashboard', target: 'bifrost', kind: 'async', label: '/api/bifrost/*', animated: true },
			{ source: 'hel1', target: 'bifrost', kind: 'dep', label: 'hosts' },
			{ source: 'bifrost', target: 'satori', kind: 'dep', label: 'runs' },
			{ source: 'api', target: 'stripe', kind: 'sync', label: 'HTTPS' },
			{ source: 'midgard', target: 'otel', kind: 'event', label: 'spans' },
			{ source: 'hel1', target: 'otel', kind: 'event', label: 'spans' }
		]
	}
};

import type { SceneDoc } from '../schema';

// Group tints — PaaS (slate), Host (slate-dark), Edge/TLS (blue), Build (amber cicd).
const C = {
	paas: '#94a3b8',
	host: '#64748b',
	edge: '#3b82f6',
	build: '#eab308'
};

/**
 * Hosting & Deployment — the Level-2 drill-down behind the "Hosting &
 * Deployment" cylinder of `9realms-stack`. Draws Coolify on the midgard
 * Hetzner VPS, the Node adapter container, Traefik + ACME at the edge, and
 * the auto-deploy-on-push flow. Authored from the stack panel + `CLAUDE.md`.
 * High-level where exact internals aren't known from the repo/docs.
 */
export const hostingStackScene: SceneDoc = {
	id: 'stack-hosting',
	slug: 'stack-hosting',
	name: 'Hosting & Deployment — Coolify on midgard',
	description: 'Self-hosted PaaS: Coolify, the Node container, Traefik + ACME, auto-deploy.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Hosting & Deployment' },
		groups: [
			{ id: 'paas', label: 'PaaS', color: C.paas },
			{ id: 'host', label: 'Host', color: C.host },
			{ id: 'edge', label: 'Edge / TLS', color: C.edge },
			{ id: 'build', label: 'Build', color: C.build }
		],
		nodes: [
			{
				id: 'coolify',
				label: 'Coolify',
				group: 'paas',
				color: C.paas,
				panel: `**Self-hosted PaaS, not a managed platform.**

- Watches the repo and redeploys on push
- Builds the container and wires Traefik in front
- Drill into the system view for the GitHub → Coolify wiring`,
				link: { sceneId: '9realms-architecture', label: 'System architecture' }
			},
			{
				id: 'midgard',
				label: 'midgard VPS',
				group: 'host',
				color: C.host,
				panel: `**The Hetzner production box** (formerly "drasil").

- Runs the 9realms dashboard + satoridigital.io
- Distinct from the agent host (satori-daemon-hel1)`
			},
			{
				id: 'adapter',
				label: 'adapter-node container',
				group: 'build',
				color: C.build,
				panel: `**The deployable artifact.**

- \`@sveltejs/adapter-node\`, containerized
- One image per push, run by Coolify on midgard`
			},
			{
				id: 'traefik',
				label: 'Traefik',
				group: 'edge',
				color: C.edge,
				panel: `**The reverse proxy at the edge.**

- Routes inbound traffic to the app container
- Coolify-managed; terminates TLS via ACME`
			},
			{
				id: 'acme',
				label: 'ACME certs',
				group: 'edge',
				color: C.edge,
				panel: `**Automatic TLS.**

- Certs issued via ACME
- Mind the DNS-wildcard-scope trap (a logged pitfall)`
			}
		],
		edges: [
			{ source: 'coolify', target: 'adapter', kind: 'dep', label: 'builds' },
			{ source: 'coolify', target: 'midgard', kind: 'dep', label: 'deploys to' },
			{ source: 'adapter', target: 'midgard', kind: 'dep', label: 'runs on' },
			{ source: 'traefik', target: 'adapter', kind: 'sync', label: 'proxies', animated: true },
			{ source: 'traefik', target: 'acme', kind: 'dep', label: 'TLS' },
			{ source: 'coolify', target: 'traefik', kind: 'dep', label: 'manages' }
		]
	}
};

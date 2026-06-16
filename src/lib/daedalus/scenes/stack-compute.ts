import type { SceneDoc } from '../schema';

// Group tints — Hosts (slate), Network (blue), Workloads (varied per host role).
const C = {
	host: '#64748b',
	network: '#3b82f6',
	web: '#f5a623',
	agents: '#a855f7'
};

/**
 * Cloud & Compute — the Level-2 drill-down behind the "Cloud & Compute"
 * cylinder of `9realms-stack`. Draws the actual Hetzner boxes (midgard, the
 * satori-daemon host, and ygg), the Tailscale mesh that ties them together,
 * and the bootstrap-then-close-public-SSH posture. Authored from the stack
 * panel + `CLAUDE.md` / `ref/HEIMDALL.md`. High-level where exact internals
 * aren't known from the repo/docs.
 */
export const computeStackScene: SceneDoc = {
	id: 'stack-compute',
	slug: 'stack-compute',
	name: 'Cloud & Compute — Hetzner + Tailscale',
	description: 'The boxes: midgard, the agent host, ygg, tied by a Tailscale mesh.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Cloud & Compute' },
		groups: [
			{ id: 'hosts', label: 'Hetzner hosts', color: C.host },
			{ id: 'network', label: 'Network', color: C.network },
			{ id: 'workloads', label: 'Workloads', color: C.web }
		],
		nodes: [
			{
				id: 'midgard',
				label: 'midgard',
				group: 'hosts',
				color: C.host,
				panel: `**Production web host** (formerly "drasil").

- Runs this dashboard + satoridigital.io via Coolify
- A Hetzner VPS reachable on its public IP`
			},
			{
				id: 'hel1',
				label: 'satori-daemon-hel1',
				group: 'hosts',
				color: C.host,
				panel: `**The agent host** (Hetzner CPX32).

- Hosts the autonomous agents (the Bifrost daemon)
- Public SSH is closed — reached over Tailscale
- Distinct from the web box on purpose`
			},
			{
				id: 'ygg',
				label: 'ygg',
				group: 'hosts',
				color: C.host,
				panel: `**The dev / Coolify + ygg-otel host.**

- Carries Coolify and the \`ygg-otel\` observability backend
- A member of the tailnet (a path to the agent host runs through here)`
			},
			{
				id: 'tailscale',
				label: 'Tailscale mesh',
				group: 'network',
				color: C.network,
				panel: `**The private mesh that ties the hosts together.**

- WireGuard-based overlay between the Hetzner boxes
- The way midgard reaches the SSH-closed agent host
- Lets public SSH stay shut after bootstrap`
			},
			{
				id: 'web',
				label: 'Web workloads',
				group: 'workloads',
				color: C.web,
				panel: `**What midgard runs.**

- The 9realms dashboard container + satoridigital.io
- Fronted by Traefik, deployed by Coolify`
			},
			{
				id: 'daemon',
				label: 'Bifrost daemon',
				group: 'workloads',
				color: C.agents,
				panel: `**What the agent host runs.**

- The Bifrost daemon hosting the realm-agents
- Reached from the dashboard over \`/api/bifrost/*\``,
				link: { sceneId: 'bifrost-client', label: 'Bifrost internals' }
			}
		],
		edges: [
			{ source: 'midgard', target: 'web', kind: 'dep', label: 'runs' },
			{ source: 'hel1', target: 'daemon', kind: 'dep', label: 'runs' },
			{ source: 'midgard', target: 'tailscale', kind: 'dep', label: 'member' },
			{ source: 'hel1', target: 'tailscale', kind: 'dep', label: 'member' },
			{ source: 'ygg', target: 'tailscale', kind: 'dep', label: 'member' },
			{ source: 'midgard', target: 'hel1', kind: 'async', label: 'via Tailscale', animated: true }
		]
	}
};

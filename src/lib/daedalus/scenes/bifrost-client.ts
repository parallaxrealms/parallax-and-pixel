import type { SceneDoc } from '../schema';

// Group tints — Dashboard (frontend amber), Daemon (agents violet),
// pi-runtime (a runtime teal-blue), External (slate).
const C = {
	dashboard: '#f5a623',
	daemon: '#a855f7',
	runtime: '#3b82f6',
	external: '#64748b'
};

/**
 * Bifrost client — the Level-2 container graph behind the "AI Agents" cylinder
 * of `9realms-stack` (and the `bifrost` node of `9realms-architecture`). It draws
 * who-talks-to-whom across the boundary between the 9realms dashboard and the
 * Bifrost daemon, down into the pi-runtime that the realm-agents run on.
 *
 * Authored from `ref/9REALMS.md`, `ref/BIFROST.md`, `ref/REALM_AGENTS.md` and the
 * stack scene. Where exact internals aren't known from the repo/docs the panels
 * stay at the level of the relationship rather than inventing specifics.
 */
export const bifrostClientScene: SceneDoc = {
	id: 'bifrost-client',
	slug: 'bifrost-client',
	name: 'Bifrost — Client & Daemon',
	description: 'The 9realms dashboard talking to the Bifrost daemon and the agent runtime.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Bifrost Client' },
		groups: [
			{ id: 'dashboard', label: 'Dashboard (9realms)', color: C.dashboard },
			{ id: 'daemon', label: 'Bifrost daemon (satori-daemon-hel1)', color: C.daemon },
			{ id: 'pi-runtime', label: 'pi-runtime', color: C.runtime },
			{ id: 'external', label: 'External', color: C.external }
		],
		nodes: [
			{
				id: 'bifrost-ui',
				label: 'BIFROST mode UI',
				group: 'dashboard',
				color: C.dashboard,
				panel: `**The dashboard face of the Bifrost daemon** — \`/dashboard/bifrost\` (chat / settings / memory).

- Full-width agent-comms surface, no sidebar; rainbow-bridge identity
- The single place the operator talks to the autonomous realm-agents
- Reaches a single live agent (Satori) today; a session picker arrives as other agents activate`
			},
			{
				id: 'rest-client',
				label: 'DaemonRestClient',
				group: 'dashboard',
				color: C.dashboard,
				panel: `**The dashboard's typed client to the daemon's REST surface.**

- Exposes the six \`getYgg*\` / \`refreshYgg\` methods used by MIMIR's live docs/components sync
- Authenticates over the existing **Supabase-JWT channel** — it needs no separate token
- Unwraps the daemon's response envelopes (\`{conversation}\`, \`{messages}\`, …) into bare values`
			},
			{
				id: 'api-bifrost',
				label: '/api/bifrost/*',
				group: 'daemon',
				color: C.daemon,
				panel: `**The HTTPS boundary** between the dashboard and the daemon.

- Server-side SvelteKit routes under \`/api/bifrost/*\` proxy the client to the daemon
- Secrets (\`BIFROST_API_KEY\`) stay server-side; the browser never holds daemon credentials
- Per-session bearer is the *agent's*, not ODIN's — credential boundaries are enforced here`
			},
			{
				id: 'daemon',
				label: 'Bifrost daemon',
				group: 'daemon',
				color: C.daemon,
				panel: `**The single process that hosts the realm-agents** (the rainbow bridge).

- Runs on **satori-daemon-hel1** (Hetzner CPX32), Tailscale mesh to midgard
- Shared infra: Discord gateway, provider routing, a $2/day token-budget pool, job scheduler, audit log
- Third name for the same daemon (Mimir → Satori → Bifrost)`
			},
			{
				id: 'realm-agents',
				label: 'realm-agents',
				group: 'daemon',
				color: C.daemon,
				panel: `**The autonomous agents Bifrost hosts** (satori-mushin, mimir-urd, …).

- One per active realm; each has its own SOUL, SQLite DB, GitHub PAT scope, egress allowlist, Discord persona, cron table
- Satori is the live agent today (PM / briefer); others activate per roadmap
- Can spawn ephemeral sub-agents per task`
			},
			{
				id: 'pi-agent-core',
				label: 'pi-agent-core',
				group: 'pi-runtime',
				color: C.runtime,
				link: { sceneId: 'pi-agent-core' },
				panel: `**The agent runtime** the realm-agents run on.

- Owns the agent loop — model calls, tool dispatch, and context/memory
- Shared across realms; each agent supplies its own SOUL, tools, and credentials
- Drill in for the component-level view.`
			},
			{
				id: 'pi-coding-harness',
				label: 'pi-coding-harness',
				group: 'pi-runtime',
				color: C.runtime,
				panel: `**The coding harness** the runtime drives for code-editing work.

- Gives an agent file-editing / command-running capability for repos in its PAT scope
- Invoked by \`pi-agent-core\` when a task needs to touch code`
			},
			{
				id: 'providers',
				label: 'Anthropic / providers',
				group: 'external',
				color: C.external,
				panel: `**The model providers.**

- Reached via provider routing (Anthropic / OpenRouter)
- Model tier ladder **FREE → HAIKU → SONNET → OPUS**, budget- and key-aware
- Drawn from the shared $2/day token-budget pool with a priority order`
			},
			{
				id: 'discord',
				label: 'Discord',
				group: 'external',
				color: C.external,
				panel: `**The human-facing bridge.**

- One bot connection in; N webhook personas out (one per realm-agent)
- Agents post activity / ask for input through their own persona`
			},
			{
				id: 'otel',
				label: 'ygg-otel bridge',
				group: 'external',
				color: C.external,
				panel: `**Observability egress.**

- The daemon emits OpenTelemetry spans + metrics through the \`ygg-otel\` backend
- Surfaced in the HEIMDALL mode (which watches Bifrost itself)`
			}
		],
		edges: [
			{ source: 'bifrost-ui', target: 'rest-client', kind: 'dep' },
			{ source: 'rest-client', target: 'api-bifrost', kind: 'sync', label: 'Supabase JWT', animated: true },
			{ source: 'api-bifrost', target: 'daemon', kind: 'sync', label: 'HTTPS' },
			{ source: 'daemon', target: 'realm-agents', kind: 'dep', label: 'hosts' },
			{ source: 'realm-agents', target: 'pi-agent-core', kind: 'dep', label: 'runs on' },
			{ source: 'pi-agent-core', target: 'pi-coding-harness', kind: 'dep' },
			{ source: 'pi-agent-core', target: 'providers', kind: 'sync', label: 'model tier', animated: true },
			{ source: 'realm-agents', target: 'discord', kind: 'event' },
			{ source: 'daemon', target: 'otel', kind: 'event', label: 'spans' }
		]
	}
};

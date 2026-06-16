import type { SceneDoc } from '../schema';

/**
 * The 9realms production stack — the first authored DAEDALUS scene, and the
 * proving ground for the Stack primitive. Each layer's panel names the real
 * tech, services, and patterns 9realms runs in production. Hand-written VizData
 * (static authored scene).
 */
export const nineRealmsStackScene: SceneDoc = {
	id: '9realms-stack',
	slug: '9realms-stack',
	name: '9realms — Full-Stack Production Reality',
	description: 'Every layer of the 9realms admin dashboard, top to bottom.',
	primitive: 'stack',
	dimension: '3d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: '9realms Stack' },
		layers: [
			{
				id: 'frontend',
				label: 'Frontend',
				sublabel: 'SvelteKit 5 · Tailwind 4',
				color: '#f5a623',
				panel: `**The dashboard UI** — a single SvelteKit app with a mode-switching shell.

- **SvelteKit 5** with runes (\`$state\`, \`$derived\`, \`$effect\`)
- **Tailwind 4** (\`@theme inline\`, no \`tailwind.config\`) + per-mode \`--mode-*\` CSS tokens
- **shadcn / bits-ui** components, **lucide** icons
- **three.js** scenes (the Yggdrasil landing, and now DAEDALUS)
- Nine operational modes behind a \`[mode]\` dynamic route + \`([mode])\` route groups`,
				link: { sceneId: 'stack-frontend' }
			},
			{
				id: 'api',
				label: 'API & Backend Logic',
				sublabel: 'SvelteKit server · @parallaxrealms/api-*',
				color: '#3b82f6',
				panel: `**Server routes, form actions, and the shared API packages.**

- SvelteKit \`+page.server.ts\` / form actions / \`/api/*\` endpoints
- \`@parallaxrealms/api-core\`, \`api-auth\`, \`api-ecom\` — the factory-handler packages
- \`/api/bifrost/*\` HTTPS surface to the agent daemon
- Server-side adapters keep secrets off the client`,
				link: { sceneId: '9realms-architecture' }
			},
			{
				id: 'database',
				label: 'Database & Storage',
				sublabel: 'Supabase Postgres · nine schema',
				color: '#14b8a6',
				panel: `**Supabase Postgres** is the system of record.

- The \`nine\` schema (renamed from \`odin\` this cycle)
- Supabase **Storage** buckets (\`9realms\`) for media/assets
- Multi-tenant via a \`site_id\` TEXT column; cache-first \`.cache/{site_id}/{table}.json\` loading
- The future \`nine.daedalus_scenes\` table will store visualization scenes`,
				link: { sceneId: 'stack-database' }
			},
			{
				id: 'auth',
				label: 'Auth & Permissions',
				sublabel: 'Supabase Auth · RLS · team roles',
				color: '#22c55e',
				panel: `**Who can see and do what.**

- **Supabase Auth** (magic-link + OAuth), JWT validated locally
- **Row-Level Security** policies, team-based roles (admin / power-user / client)
- A \`hooks.server.ts\` route guard + per-route role checks (defense in depth)
- The shared \`auth.users\` boundary is treated carefully in multi-tenant land`,
				link: { sceneId: 'stack-auth' }
			},
			{
				id: 'hosting',
				label: 'Hosting & Deployment',
				sublabel: 'Coolify · Hetzner midgard',
				color: '#94a3b8',
				panel: `**Self-hosted PaaS, not a managed platform.**

- **Coolify** on the **midgard** Hetzner VPS (formerly "drasil")
- \`@sveltejs/adapter-node\`, containerized, Traefik in front
- Auto-deploy on push; ACME certs (mind the DNS-wildcard-scope trap)`,
				link: { sceneId: 'stack-hosting' }
			},
			{
				id: 'compute',
				label: 'Cloud & Compute',
				sublabel: 'Hetzner · Tailscale mesh',
				color: '#64748b',
				panel: `**The boxes.**

- **midgard** — production sites (this dashboard, satoridigital.io)
- **satori-daemon-hel1** (CPX32) — hosts the autonomous agents (Bifrost)
- **Tailscale** mesh ties them together; bootstrap-then-close-public-SSH`,
				link: { sceneId: 'stack-compute' }
			},
			{
				id: 'cicd',
				label: 'CI/CD & Version Control',
				sublabel: 'GitHub · pnpm · Coolify',
				color: '#eab308',
				panel: `**From commit to live.**

- **GitHub** over HTTPS (Windows credential manager — not SSH)
- **pnpm** workspace; the \`@parallaxrealms/*\` packages publish to GitHub Packages
- Coolify watches the repo and redeploys on push`,
				link: { sceneId: 'stack-cicd' }
			},
			{
				id: 'security',
				label: 'Security & RLS',
				sublabel: 'GRANT + RLS · credential boundaries',
				color: '#f97316',
				panel: `**Two-layer Postgres security + boundaries that beat policy.**

- \`GRANT\` + **RLS** as two independent layers (Postgres-general pattern)
- Per-tenant \`site_id\` filtering everywhere (\`applySiteFilter\`)
- Credential boundaries over prompt-injection-vulnerable policy boundaries
- Lessons logged as pitfalls (e.g. unconditional triggers on shared \`auth.users\`)`,
				link: { sceneId: 'stack-security' }
			},
			{
				id: 'observability',
				label: 'Observability',
				sublabel: 'OpenTelemetry · Glances · Heimdall',
				color: '#ef4444',
				panel: `**Knowing what's happening.**

- **OpenTelemetry** via the \`ygg-otel\` backend (spans + metrics)
- **Glances** per-host, surfaced behind Traefik basicauth
- The **HEIMDALL** mode is the in-dashboard watcher (servers, telemetry, recommendations)`,
				link: { sceneId: 'stack-observability' }
			},
			{
				id: 'agents',
				label: 'AI Agents',
				sublabel: 'Bifrost daemon · Satori · model tiering',
				color: '#a855f7',
				panel: `**The autonomous layer.**

- **Bifrost** daemon (on satori-daemon-hel1) hosts the realm-agents
- **Satori** is the live agent today (PM / briefer); reached via the BIFROST mode + Discord
- Model tier ladder: **FREE → HAIKU → SONNET → OPUS**, budget- and key-aware
- Mythological sub-agent naming (\`satori-mushin\`, \`mimir-urd\`, …)`,
				link: { sceneId: 'bifrost-client', label: 'Bifrost internals' }
			},
			{
				id: 'integrations',
				label: 'Payments & Integrations',
				sublabel: 'Stripe · Square · Resend · Replicate',
				color: '#38bdf8',
				panel: `**Talking to the outside world.**

- **Stripe** + **Square** dual-path payments (intentionally leaky abstraction)
- **Resend** transactional email; the Send Email Hook for auth mail
- **Replicate** for image generation; **Firecrawl** + **Lighthouse** for site audits`,
				link: { sceneId: 'stack-integrations' }
			}
		]
	}
};

import type { SceneDoc } from '../schema';

// Group tints — Source (amber cicd), Packages (blue), Deploy (slate infra).
const C = {
	source: '#eab308',
	packages: '#3b82f6',
	deploy: '#94a3b8'
};

/**
 * CI/CD & Version Control — the Level-2 drill-down behind the "CI/CD & Version
 * Control" cylinder of `9realms-stack`. Draws the commit-to-live pipeline:
 * GitHub (HTTPS auth) → Coolify → midgard, plus the pnpm workspace and the
 * `@parallaxrealms/*` packages publishing to GitHub Packages. Authored from
 * the stack panel + `CLAUDE.md`. High-level where exact internals aren't known.
 */
export const cicdStackScene: SceneDoc = {
	id: 'stack-cicd',
	slug: 'stack-cicd',
	name: 'CI/CD & Version Control — GitHub → Coolify → midgard',
	description: 'From commit to live: GitHub, pnpm workspace, GitHub Packages, Coolify deploy.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'CI/CD & Version Control' },
		groups: [
			{ id: 'source', label: 'Source control', color: C.source },
			{ id: 'packages', label: 'Packages', color: C.packages },
			{ id: 'deploy', label: 'Deploy', color: C.deploy }
		],
		nodes: [
			{
				id: 'github',
				label: 'GitHub',
				group: 'source',
				color: C.source,
				panel: `**Source of truth + deploy trigger.**

- HTTPS auth via the Windows credential manager (not SSH)
- A push is the event that starts a deploy
- Repo: \`parallaxrealms/9realms\``
			},
			{
				id: 'pnpm',
				label: 'pnpm workspace',
				group: 'packages',
				color: C.packages,
				panel: `**The monorepo tooling.**

- A pnpm workspace ties the app to its shared packages
- \`pnpm check\` is the integration gate before push`
			},
			{
				id: 'parallax-pkgs',
				label: '@parallaxrealms/*',
				group: 'packages',
				color: C.packages,
				panel: `**The shared API packages.**

- \`api-core\`, \`api-auth\`, \`api-ecom\` — the factory-handler packages
- Published to GitHub Packages
- Updated via \`pnpm update @parallaxrealms/*\` (never a destructive reinstall)`
			},
			{
				id: 'coolify',
				label: 'Coolify',
				group: 'deploy',
				color: C.deploy,
				panel: `**The deploy engine.**

- Watches the repo, rebuilds the container on push
- Drill into the system view for the host wiring`,
				link: { sceneId: '9realms-architecture', label: 'System architecture' }
			},
			{
				id: 'midgard',
				label: 'midgard',
				group: 'deploy',
				color: C.deploy,
				panel: `**The production target.**

- Coolify runs the freshly-built container here
- The live dashboard end of the pipeline`
			}
		],
		edges: [
			{ source: 'github', target: 'coolify', kind: 'event', label: 'push', animated: true },
			{ source: 'coolify', target: 'midgard', kind: 'dep', label: 'redeploys' },
			{ source: 'pnpm', target: 'parallax-pkgs', kind: 'dep', label: 'resolves' },
			{ source: 'parallax-pkgs', target: 'github', kind: 'data', label: 'GitHub Packages' },
			{ source: 'github', target: 'pnpm', kind: 'dep', label: 'workspace' }
		]
	}
};

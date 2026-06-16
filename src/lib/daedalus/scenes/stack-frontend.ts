import type { SceneDoc } from '../schema';

// Group tints — App shell (amber), Routing (blue), Styling (teal), 3D/Visual (violet).
const C = {
	shell: '#f5a623',
	routing: '#3b82f6',
	styling: '#14b8a6',
	visual: '#a855f7'
};

/**
 * Frontend — the Level-2 drill-down behind the "Frontend" cylinder of
 * `9realms-stack`. Draws how the SvelteKit app shell, the `[mode]` routing,
 * the per-mode theming, the component layer, and the three.js scenes fit
 * together. Authored from the stack panel + `CLAUDE.md` / `ref/9REALMS.md`.
 * Panels stay at the level of the relationship where exact internals aren't
 * known from the repo/docs.
 */
export const frontendStackScene: SceneDoc = {
	id: 'stack-frontend',
	slug: 'stack-frontend',
	name: 'Frontend — SvelteKit App Shell',
	description: 'The dashboard UI: app shell, mode routing, theming, components, three.js.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Frontend' },
		groups: [
			{ id: 'shell', label: 'App shell', color: C.shell },
			{ id: 'routing', label: 'Mode routing', color: C.routing },
			{ id: 'styling', label: 'Styling & components', color: C.styling },
			{ id: 'visual', label: '3D / visual', color: C.visual }
		],
		nodes: [
			{
				id: 'app',
				label: 'SvelteKit 5 app',
				group: 'shell',
				color: C.shell,
				panel: `**A single SvelteKit 5 app with a mode-switching shell.**

- Svelte 5 runes throughout (\`$state\`, \`$derived\`, \`$effect\`, \`$props()\`)
- One deploy serves all nine operational modes
- Lowercase DOM events (\`onclick\`, \`oninput\`), no colons`
			},
			{
				id: 'sidebar',
				label: 'Sidebar & nav',
				group: 'shell',
				color: C.shell,
				panel: `**Data-driven navigation chrome.**

- The sidebar is decomposed into a handful of components, driven from the navigation config
- Navigation tree + command registry are config, not hard-coded markup
- BIFROST is the exception — full-width, no sidebar, a top tab bar instead`
			},
			{
				id: 'mode-route',
				label: '[mode] route',
				group: 'routing',
				color: C.routing,
				panel: `**Route-based navigation — no store-based tab switching.**

- Every tab is a SvelteKit route under \`dashboard/[mode]/([mode_name])/\`
- Programmatic moves use \`goto()\`, never an imperative tab store
- Neutral routes (settings, help, notes, …) live outside \`[mode]\``
			},
			{
				id: 'modes',
				label: 'Operational modes',
				group: 'routing',
				color: C.routing,
				panel: `**Seven active + two locked realms.**

- ODIN (home/root) · SATORI · VULCAN · THOTH · MIMIR · HEIMDALL · BIFROST
- \`realm8\` / \`realm9\` are locked "???" placeholders
- Each mode is a branch off ODIN, reachable from the home hub`
			},
			{
				id: 'theme',
				label: 'Mode themes',
				group: 'styling',
				color: C.styling,
				panel: `**Per-mode visual identity via CSS tokens.**

- \`--mode-*\` CSS custom properties skin each realm
- BIFROST's \`.theme-bifrost\` hue-cycles a \`--bifrost-hue\` (rainbow bridge)
- Sharp edges, compact density — see the design system`
			},
			{
				id: 'tailwind',
				label: 'Tailwind 4',
				group: 'styling',
				color: C.styling,
				panel: `**Tailwind 4 — config-less.**

- \`@theme inline\` tokens, no \`tailwind.config\` file
- No border-radius anywhere; compact padding by convention`
			},
			{
				id: 'components',
				label: 'shadcn / bits-ui',
				group: 'styling',
				color: C.styling,
				panel: `**The component layer.**

- shadcn / bits-ui primitives, lucide icons
- Mobile contract: dialogs bottom-sheet on small screens, tables dual-render (cards + table)
- No hover-only controls`
			},
			{
				id: 'threejs',
				label: 'three.js scenes',
				group: 'visual',
				color: C.visual,
				panel: `**The 3D / generative surfaces.**

- The procedural Yggdrasil tree landing (ODIN trunk + orbiting realm spheres)
- DAEDALUS — the visualization engine this scene lives in
- Rendered client-side; the rest of the shell stays 2D`
			}
		],
		edges: [
			{ source: 'app', target: 'sidebar', kind: 'dep', label: 'mounts' },
			{ source: 'app', target: 'mode-route', kind: 'dep', label: 'routes' },
			{ source: 'mode-route', target: 'modes', kind: 'dep', label: 'resolves' },
			{ source: 'sidebar', target: 'mode-route', kind: 'sync', label: 'goto()' },
			{ source: 'modes', target: 'theme', kind: 'dep', label: 'skins' },
			{ source: 'theme', target: 'tailwind', kind: 'dep', label: 'tokens' },
			{ source: 'app', target: 'components', kind: 'dep', label: 'uses' },
			{ source: 'components', target: 'tailwind', kind: 'dep', label: 'styled by' },
			{ source: 'app', target: 'threejs', kind: 'dep', label: 'renders' }
		]
	}
};

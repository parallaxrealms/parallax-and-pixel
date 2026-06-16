// DAEDALUS scene library. Built-in scenes ship in code; user-authored scenes
// persist to localStorage. This is the v0.1 store — DB-backed persistence
// (nine.daedalus_scenes) replaces localStorage in a later slice.
import { browser } from '$app/environment';
import type { SceneDoc } from './schema';
import { nineRealmsStackScene } from './scenes/9realms-stack';
import { nineRealmsArchitectureScene } from './scenes/9realms-architecture';
import { bifrostClientScene } from './scenes/bifrost-client';
import { piAgentCoreScene } from './scenes/pi-agent-core';
import { frontendStackScene } from './scenes/stack-frontend';
import { databaseStackScene } from './scenes/stack-database';
import { authStackScene } from './scenes/stack-auth';
import { hostingStackScene } from './scenes/stack-hosting';
import { computeStackScene } from './scenes/stack-compute';
import { cicdStackScene } from './scenes/stack-cicd';
import { securityStackScene } from './scenes/stack-security';
import { observabilityStackScene } from './scenes/stack-observability';
import { integrationsStackScene } from './scenes/stack-integrations';
import { sampleHeatmapScene } from './scenes/sample-heatmap';
import { sampleSankeyScene } from './scenes/sample-sankey';
import { sampleTimelineScene } from './scenes/sample-timeline';
import { sampleTreemapScene } from './scenes/sample-treemap';

const KEY = 'pxp-daedalus-scenes';

// ── Folder constants (the Studio rail groups every scene by its `folder`) ──────
/** The 9realms system atlas (authored topology scenes). */
const F_ATLAS = 'Atlas';
/** Per-primitive blank starting points (one Untitled scene per viz type). */
const F_TEMPLATES = 'Templates';
/** Per-primitive demos populated with realistic data. */
const F_SAMPLES = 'Samples';
// NB: the 'Live' folder (adapter-bound scenes) was dropped in the PxP MVP port —
// the only live scene (nav-tree) depended on 9realms-only adapters. Re-add when
// PxP grows its own adapters (see adapters/registry.ts).

/** Stamp a folder onto a scene without mutating the imported source object. */
function withFolder(s: SceneDoc, folder: string): SceneDoc {
	return { ...s, folder };
}

// ── Templates: one blank starting point per primitive ─────────────────────────
// Built by calling each new*Scene() factory, then overriding the random id with a
// STABLE `template-<primitive>` id and a clean display name. These are read-only.
const TEMPLATE_DEFS: { id: string; name: string; make: () => SceneDoc }[] = [
	{ id: 'template-stat', name: 'Stat', make: newStatScene },
	{ id: 'template-gauge', name: 'Gauge', make: newGaugeScene },
	{ id: 'template-bullet', name: 'Bullet', make: newBulletScene },
	{ id: 'template-bar', name: 'Bar', make: newBarScene },
	{ id: 'template-pie', name: 'Pie', make: newPieScene },
	{ id: 'template-radar', name: 'Radar', make: newRadarScene },
	{ id: 'template-line', name: 'Line', make: newLineScene },
	{ id: 'template-area', name: 'Area', make: newAreaScene },
	{ id: 'template-scatter', name: 'Scatter', make: newScatterScene },
	{ id: 'template-stack', name: '3D Stack', make: newStackScene },
	{ id: 'template-graph', name: 'Node Graph', make: newGraphScene },
	{ id: 'template-tree', name: 'Tree', make: newTreeScene },
	{ id: 'template-heatmap', name: 'Heatmap', make: newHeatmapScene },
	{ id: 'template-sankey', name: 'Sankey', make: newSankeyScene },
	{ id: 'template-timeline', name: 'Timeline', make: newTimelineScene },
	{ id: 'template-treemap', name: 'Treemap', make: newTreemapScene },
	{ id: 'template-table', name: 'Table', make: newTableScene }
];

/**
 * Browsable, read-only blank templates — one per primitive — all in the
 * 'Templates' folder with stable ids (`template-bar`, `template-radar`, …).
 */
export const TEMPLATE_SCENES: SceneDoc[] = TEMPLATE_DEFS.map(({ id, name, make }) => ({
	...make(),
	id,
	slug: id,
	name,
	folder: F_TEMPLATES
}));

// ── Inline samples (the primitives without a dedicated sample-*.ts file) ───────
const INLINE_SAMPLE_SCENES: SceneDoc[] = [
	{
		id: 'sample-bar',
		slug: 'sample-bar',
		name: 'Sample — Requests by Realm',
		description: 'API requests served per realm over the last 24h (thousands).',
		primitive: 'bar',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			meta: { title: 'Requests by Realm' },
			categories: [
				{ id: 'midgard', label: 'Midgard', value: 184, color: '#4d7cff' },
				{ id: 'asgard', label: 'Asgard', value: 142, color: '#14b8a6' },
				{ id: 'vanaheim', label: 'Vanaheim', value: 97, color: '#f5a623' },
				{ id: 'alfheim', label: 'Alfheim', value: 63, color: '#a855f7' },
				{ id: 'jotunheim', label: 'Jotunheim', value: 41, color: '#f43f5e' }
			]
		}
	},
	{
		id: 'sample-pie',
		slug: 'sample-pie',
		name: 'Sample — Token Spend by Tier',
		description: 'Share of monthly token spend across the model-tier ladder.',
		primitive: 'pie',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			meta: { title: 'Token Spend by Tier' },
			categories: [
				{ id: 'free', label: 'FREE', value: 12, color: '#14b8a6' },
				{ id: 'haiku', label: 'HAIKU', value: 28, color: '#22c55e' },
				{ id: 'sonnet', label: 'SONNET', value: 41, color: '#4d7cff' },
				{ id: 'opus', label: 'OPUS', value: 19, color: '#a855f7' }
			]
		}
	},
	{
		id: 'sample-line',
		slug: 'sample-line',
		name: 'Sample — Latency Trend',
		description: 'p50 vs p95 API latency (ms) across a 12-hour window.',
		primitive: 'line',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans', showDots: true },
		data: {
			meta: { title: 'Latency Trend' },
			series: [
				{
					id: 'p50',
					name: 'p50',
					color: '#4d7cff',
					points: [0, 2, 4, 6, 8, 10, 12].map((x, i) => ({ x: `${x}:00`, y: [42, 38, 45, 51, 47, 44, 40][i] }))
				},
				{
					id: 'p95',
					name: 'p95',
					color: '#f5a623',
					points: [0, 2, 4, 6, 8, 10, 12].map((x, i) => ({ x: `${x}:00`, y: [118, 102, 134, 167, 151, 129, 112][i] }))
				}
			]
		}
	},
	{
		id: 'sample-area',
		slug: 'sample-area',
		name: 'Sample — Traffic Composition',
		description: 'Stacked request volume by channel over a week (thousands).',
		primitive: 'area',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans', stacked: true },
		data: {
			meta: { title: 'Traffic Composition' },
			series: [
				{
					id: 'web',
					name: 'Web',
					color: '#4d7cff',
					points: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x, i) => ({ x, y: [48, 52, 60, 58, 64, 33, 29][i] }))
				},
				{
					id: 'api',
					name: 'API',
					color: '#14b8a6',
					points: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x, i) => ({ x, y: [31, 34, 38, 41, 44, 22, 19][i] }))
				},
				{
					id: 'agent',
					name: 'Agent',
					color: '#a855f7',
					points: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x, i) => ({ x, y: [12, 15, 18, 21, 26, 14, 11][i] }))
				}
			]
		}
	},
	{
		id: 'sample-scatter',
		slug: 'sample-scatter',
		name: 'Sample — Cost vs Latency',
		description: 'Per-request cost (¢) against latency (ms), split by model tier.',
		primitive: 'scatter',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans', showDots: true },
		data: {
			meta: { title: 'Cost vs Latency' },
			series: [
				{
					id: 'haiku',
					name: 'HAIKU',
					color: '#22c55e',
					points: [
						{ x: 40, y: 2 }, { x: 52, y: 3 }, { x: 47, y: 2 }, { x: 61, y: 4 }, { x: 55, y: 3 }, { x: 44, y: 2 }
					]
				},
				{
					id: 'sonnet',
					name: 'SONNET',
					color: '#4d7cff',
					points: [
						{ x: 88, y: 9 }, { x: 102, y: 11 }, { x: 95, y: 10 }, { x: 121, y: 13 }, { x: 110, y: 12 }, { x: 99, y: 10 }
					]
				},
				{
					id: 'opus',
					name: 'OPUS',
					color: '#a855f7',
					points: [
						{ x: 167, y: 38 }, { x: 184, y: 44 }, { x: 151, y: 33 }, { x: 198, y: 51 }, { x: 173, y: 41 }
					]
				}
			]
		}
	},
	{
		id: 'sample-stat',
		slug: 'sample-stat',
		name: 'Sample — Active Sessions',
		description: 'Live sessions right now, with a 7-point trend and delta vs. the prior window.',
		primitive: 'stat',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			meta: { title: 'Active Sessions' },
			scalar: {
				value: 1284,
				unit: '',
				label: 'Active sessions',
				delta: 96,
				higherIsBetter: true,
				spark: [980, 1040, 1010, 1120, 1090, 1188, 1284]
			}
		}
	},
	{
		id: 'sample-bullet',
		slug: 'sample-bullet',
		name: 'Sample — SLA Attainment',
		description: 'Uptime attainment (%) against the 99.9% target, with risk bands.',
		primitive: 'bullet',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			meta: { title: 'SLA Attainment' },
			scalar: {
				value: 99.4,
				unit: '%',
				label: 'Uptime this month',
				min: 98,
				max: 100,
				target: 99.9,
				thresholds: [
					{ at: 98, color: '#f43f5e' },
					{ at: 99, color: '#f5a623' },
					{ at: 99.7, color: '#14b8a6' }
				]
			}
		}
	},
	{
		id: 'sample-gauge',
		slug: 'sample-gauge',
		name: 'Sample — CPU Utilization',
		description: 'Current CPU load on the primary daemon host, with caution/critical bands.',
		primitive: 'gauge',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			meta: { title: 'CPU Utilization' },
			scalar: {
				value: 72,
				unit: '%',
				label: 'satori-daemon-hel1',
				min: 0,
				max: 100,
				thresholds: [
					{ at: 0, color: '#14b8a6' },
					{ at: 70, color: '#f5a623' },
					{ at: 90, color: '#f43f5e' }
				]
			}
		}
	},
	{
		id: 'sample-table',
		slug: 'sample-table',
		name: 'Sample — Realm Health',
		description: 'Per-realm status, health score, capacity, and recent traffic trend.',
		primitive: 'table',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans', table: { density: 'comfortable', striped: true, mobileLayout: 'cards' } },
		data: {
			meta: { title: 'Realm Health' },
			tabular: {
				rowKey: 'id',
				columns: [
					{ key: 'realm', label: 'Realm', type: 'text' },
					{
						key: 'status',
						label: 'Status',
						type: 'badge',
						badgeMap: {
							healthy: { label: 'Healthy', color: '#34d399' },
							degraded: { label: 'Degraded', color: '#f5a623' },
							down: { label: 'Down', color: '#f43f5e' }
						}
					},
					{
						key: 'score',
						label: 'Health',
						type: 'heat',
						align: 'center',
						thresholds: [
							{ at: 0, color: '#f43f5e' },
							{ at: 60, color: '#f5a623' },
							{ at: 85, color: '#14b8a6' }
						]
					},
					{ key: 'capacity', label: 'Capacity', type: 'bar', max: 100, unit: '%' },
					{ key: 'trend', label: 'Traffic', type: 'sparkline' }
				],
				rows: [
					{ id: 'midgard', realm: 'Midgard', status: 'healthy', score: 96, capacity: 62, trend: [40, 44, 48, 51, 58, 60, 64] },
					{ id: 'asgard', realm: 'Asgard', status: 'healthy', score: 91, capacity: 55, trend: [31, 34, 38, 41, 44, 43, 46] },
					{ id: 'vanaheim', realm: 'Vanaheim', status: 'degraded', score: 68, capacity: 81, trend: [55, 62, 70, 78, 74, 80, 83] },
					{ id: 'alfheim', realm: 'Alfheim', status: 'healthy', score: 88, capacity: 40, trend: [18, 22, 25, 28, 30, 29, 33] },
					{ id: 'jotunheim', realm: 'Jotunheim', status: 'down', score: 22, capacity: 12, trend: [40, 30, 18, 9, 4, 2, 0] }
				]
			}
		}
	},
	{
		id: 'sample-stack',
		slug: 'sample-stack',
		name: 'Sample — Request Lifecycle Stack',
		description: 'A request flowing top-to-bottom through the 9realms runtime layers.',
		primitive: 'stack',
		dimension: '3d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			meta: { title: 'Request Lifecycle Stack' },
			layers: [
				{ id: 'edge', label: 'Edge / CDN', sublabel: 'Cloudflare', color: '#f5a623', panel: 'TLS termination, caching, and WAF at the edge.' },
				{ id: 'app', label: 'App (SvelteKit)', sublabel: 'SSR + endpoints', color: '#4d7cff', panel: 'Route handlers and server load functions.' },
				{ id: 'auth', label: 'Auth', sublabel: 'Supabase Auth', color: '#14b8a6', panel: 'Session validation and RLS context.' },
				{ id: 'data', label: 'Data', sublabel: 'Postgres (nine schema)', color: '#a855f7', panel: 'Queries against the nine schema boundary.' },
				{ id: 'storage', label: 'Storage', sublabel: 'Supabase Storage', color: '#f43f5e', panel: 'Object reads/writes for assets and exports.' }
			]
		}
	},
	{
		id: 'sample-graph',
		slug: 'sample-graph',
		name: 'Sample — Service Topology',
		description: 'How the 9realms services talk to each other (sync, data, and event edges).',
		primitive: 'graph',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			meta: { title: 'Service Topology' },
			nodes: [
				{ id: 'web', label: 'Web App', color: '#4d7cff' },
				{ id: 'api', label: 'API', color: '#14b8a6' },
				{ id: 'bifrost', label: 'Bifrost Daemon', color: '#a855f7' },
				{ id: 'db', label: 'Postgres', color: '#f5a623' },
				{ id: 'storage', label: 'Storage', color: '#f43f5e' }
			],
			edges: [
				{ source: 'web', target: 'api', kind: 'sync' },
				{ source: 'api', target: 'db', kind: 'data' },
				{ source: 'api', target: 'storage', kind: 'data' },
				{ source: 'api', target: 'bifrost', kind: 'async', animated: true },
				{ source: 'bifrost', target: 'db', kind: 'data' }
			]
		}
	},
	{
		id: 'sample-tree',
		slug: 'sample-tree',
		name: 'Sample — Nav Hierarchy',
		description: 'The dashboard navigation as a parent→child hierarchy.',
		primitive: 'tree',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			meta: { title: 'Nav Hierarchy' },
			nodes: [
				{ id: 'dashboard', label: 'Dashboard', color: '#4d7cff' },
				{ id: 'realms', label: 'Realms', color: '#14b8a6' },
				{ id: 'daedalus', label: 'DAEDALUS', color: '#a855f7' },
				{ id: 'agents', label: 'Agents', color: '#f5a623' },
				{ id: 'studio', label: 'Studio', color: '#a855f7' },
				{ id: 'library', label: 'Library', color: '#a855f7' },
				{ id: 'satori', label: 'Satori', color: '#f5a623' },
				{ id: 'mimir', label: 'Mimir', color: '#f5a623' }
			],
			edges: [
				{ source: 'dashboard', target: 'realms' },
				{ source: 'dashboard', target: 'daedalus' },
				{ source: 'dashboard', target: 'agents' },
				{ source: 'daedalus', target: 'studio' },
				{ source: 'daedalus', target: 'library' },
				{ source: 'agents', target: 'satori' },
				{ source: 'agents', target: 'mimir' }
			]
		}
	},
	{
		id: 'sample-radar',
		slug: 'sample-radar',
		name: 'Sample — Agent Capability Profile',
		description: 'Two agents compared across six capability axes (0–5).',
		primitive: 'radar',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			meta: { title: 'Agent Capability Profile' },
			radar: {
				axes: ['Reasoning', 'Speed', 'Cost', 'Tool Use', 'Recall', 'Safety'],
				max: 5,
				series: [
					{ id: 's0', name: 'Satori', color: '#4d7cff', values: [4.6, 3.2, 2.8, 4.4, 4.0, 4.8] },
					{ id: 's1', name: 'Mimir', color: '#f5a623', values: [3.8, 4.6, 4.2, 3.4, 4.5, 3.9] }
				]
			}
		}
	}
];

// The authored 9realms atlas → 'Atlas'.
const ATLAS_SCENES: SceneDoc[] = [
	nineRealmsStackScene,
	nineRealmsArchitectureScene,
	bifrostClientScene,
	piAgentCoreScene,
	// Full stack atlas (drill-down per 9realms-stack layer)
	frontendStackScene,
	databaseStackScene,
	authStackScene,
	hostingStackScene,
	computeStackScene,
	cicdStackScene,
	securityStackScene,
	observabilityStackScene,
	integrationsStackScene
].map((s) => withFolder(s, F_ATLAS));

// Primitive demos with realistic data. The four wave-2 samples ship as their own
// scene files; the rest are defined inline below. All land in the 'Samples' folder
// with a stable `sample-<primitive>` id.
export const SAMPLE_SCENES: SceneDoc[] = [
	// Existing wave-2 sample files.
	sampleHeatmapScene,
	sampleSankeyScene,
	sampleTimelineScene,
	sampleTreemapScene,
	// Inline samples filling out the remaining primitives.
	...INLINE_SAMPLE_SCENES
].map((s) => withFolder(s, F_SAMPLES));

export const BUILTIN_SCENES: SceneDoc[] = [...ATLAS_SCENES, ...SAMPLE_SCENES];
const BUILTIN_IDS = new Set(BUILTIN_SCENES.map((s) => s.id));

export function isBuiltin(id: string): boolean {
	return BUILTIN_IDS.has(id);
}

/** Read-only in the Studio: built-in atlas/live scenes, templates, and samples. */
const READONLY_IDS = new Set<string>([
	...BUILTIN_IDS,
	...TEMPLATE_SCENES.map((s) => s.id),
	...SAMPLE_SCENES.map((s) => s.id)
]);

/** True for any non-user scene (built-in, template, or sample) — gates editing. */
export function isReadOnly(id: string): boolean {
	return READONLY_IDS.has(id);
}

export function loadUserScenes(): SceneDoc[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as SceneDoc[]) : [];
	} catch {
		return [];
	}
}

function persist(scenes: SceneDoc[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(scenes));
	} catch {
		/* quota / disabled storage — ignore */
	}
}

export function saveUserScene(scene: SceneDoc): void {
	const user = loadUserScenes();
	const i = user.findIndex((s) => s.id === scene.id);
	if (i >= 0) user[i] = scene;
	else user.push(scene);
	persist(user);
}

export function deleteUserScene(id: string): void {
	persist(loadUserScenes().filter((s) => s.id !== id));
}

/** Built-in scenes first, then user-authored. */
/** Built-ins (atlas + live + samples) + templates first, then user-authored. */
export function allScenes(): SceneDoc[] {
	return [...BUILTIN_SCENES, ...TEMPLATE_SCENES, ...loadUserScenes()];
}

export function newSceneId(): string {
	return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newStackScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Stack',
		description: '',
		primitive: 'stack',
		dimension: '3d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			layers: [
				{ id: 'layer-1', label: 'Layer 1', color: '#4d7cff', panel: '' },
				{ id: 'layer-2', label: 'Layer 2', color: '#14b8a6', panel: '' }
			]
		}
	};
}

export function newGraphScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Graph',
		description: '',
		primitive: 'graph',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			nodes: [
				{ id: 'node-1', label: 'Node A', color: '#4d7cff', panel: '' },
				{ id: 'node-2', label: 'Node B', color: '#14b8a6', panel: '' }
			],
			edges: [{ source: 'node-1', target: 'node-2' }]
		}
	};
}

export function newTreeScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Tree',
		description: '',
		primitive: 'tree',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			nodes: [
				{ id: 'root', label: 'Root', color: '#4d7cff', panel: '' },
				{ id: 'child-1', label: 'Child A', color: '#14b8a6', panel: '' },
				{ id: 'child-2', label: 'Child B', color: '#f5a623', panel: '' }
			],
			edges: [
				{ source: 'root', target: 'child-1' },
				{ source: 'root', target: 'child-2' }
			]
		}
	};
}

export function newStatScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Stat',
		description: '',
		primitive: 'stat',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			scalar: {
				value: 1280,
				unit: '',
				label: 'Active sessions',
				delta: 84,
				higherIsBetter: true,
				spark: [980, 1040, 1010, 1120, 1090, 1180, 1220, 1280]
			}
		}
	};
}

export function newBulletScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Bullet',
		description: '',
		primitive: 'bullet',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			scalar: {
				value: 73,
				unit: '%',
				label: 'SLA attainment',
				min: 0,
				max: 100,
				target: 90,
				thresholds: [
					{ at: 0, color: '#f43f5e' },
					{ at: 60, color: '#f5a623' },
					{ at: 85, color: '#14b8a6' }
				]
			}
		}
	};
}

export function newGaugeScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Gauge',
		description: '',
		primitive: 'gauge',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			scalar: {
				value: 68,
				unit: '%',
				label: 'CPU utilization',
				min: 0,
				max: 100,
				thresholds: [
					{ at: 0, color: '#14b8a6' },
					{ at: 70, color: '#f5a623' },
					{ at: 90, color: '#f43f5e' }
				]
			}
		}
	};
}

export function newBarScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Bar',
		description: '',
		primitive: 'bar',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			categories: [
				{ id: 'cat-1', label: 'Category A', value: 42 },
				{ id: 'cat-2', label: 'Category B', value: 78 },
				{ id: 'cat-3', label: 'Category C', value: 56 },
				{ id: 'cat-4', label: 'Category D', value: 31 }
			]
		}
	};
}

export function newPieScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Pie',
		description: '',
		primitive: 'pie',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			categories: [
				{ id: 'cat-1', label: 'Segment A', value: 45 },
				{ id: 'cat-2', label: 'Segment B', value: 30 },
				{ id: 'cat-3', label: 'Segment C', value: 25 }
			]
		}
	};
}

export function newRadarScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Radar',
		description: '',
		primitive: 'radar',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			radar: {
				axes: ['Axis A', 'Axis B', 'Axis C', 'Axis D', 'Axis E', 'Axis F'],
				max: 5,
				series: [{ id: 's0', name: 'Series A', color: '#4d7cff', values: [3, 4, 2, 5, 3, 4] }]
			}
		}
	};
}

function sampleSeries(): SceneDoc['data']['series'] {
	const pts = (mul: number) =>
		[0, 1, 2, 3, 4, 5, 6].map((x) => ({ x, y: Math.round((Math.sin(x / 1.5) + 1.4) * mul) }));
	return [
		{ id: 'series-1', name: 'Series A', color: '#4d7cff', points: pts(20) },
		{ id: 'series-2', name: 'Series B', color: '#14b8a6', points: pts(12) }
	];
}

export function newLineScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Line',
		description: '',
		primitive: 'line',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: { series: sampleSeries() }
	};
}

export function newAreaScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Area',
		description: '',
		primitive: 'area',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans', stacked: true },
		data: { series: sampleSeries() }
	};
}

export function newScatterScene(): SceneDoc {
	const id = newSceneId();
	const rnd = (n: number) =>
		Array.from({ length: n }, () => ({ x: Math.round(Math.random() * 100), y: Math.round(Math.random() * 100) }));
	return {
		id,
		slug: id,
		name: 'Untitled Scatter',
		description: '',
		primitive: 'scatter',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans', showDots: true },
		data: {
			series: [
				{ id: 'series-1', name: 'Cluster A', color: '#4d7cff', points: rnd(14) },
				{ id: 'series-2', name: 'Cluster B', color: '#f5a623', points: rnd(14) }
			]
		}
	};
}

export function newTableScene(): SceneDoc {
	const id = newSceneId();
	const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
	return {
		id,
		slug: id,
		name: 'Untitled Table',
		description: '',
		primitive: 'table',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans', table: { density: 'comfortable', striped: true, mobileLayout: 'cards' } },
		data: {
			tabular: {
				rowKey: 'id',
				columns: [
					{ key: 'name', label: 'Name', type: 'text' },
					{
						key: 'status',
						label: 'Status',
						type: 'badge',
						badgeMap: {
							active: { label: 'Active', color: '#34d399' },
							paused: { label: 'Paused', color: '#f5a623' },
							archived: { label: 'Archived', color: '#64748b' }
						}
					},
					{
						key: 'score',
						label: 'Score',
						type: 'heat',
						align: 'center',
						thresholds: [
							{ at: 0, color: '#f43f5e' },
							{ at: 60, color: '#f5a623' },
							{ at: 85, color: '#14b8a6' }
						]
					},
					{ key: 'stock', label: 'Stock', type: 'bar', max: 100 },
					{ key: 'trend', label: 'Trend', type: 'sparkline' },
					{ key: 'updated', label: 'Updated', type: 'date', dateFormat: 'relative', align: 'right' }
				],
				rows: [
					{ id: '1', name: 'Alpha', status: 'active', score: 92, stock: 80, trend: [3, 5, 4, 7, 9, 8, 11], updated: ago(1) },
					{ id: '2', name: 'Beta', status: 'paused', score: 64, stock: 35, trend: [8, 7, 6, 6, 5, 4, 4], updated: ago(3) },
					{ id: '3', name: 'Gamma', status: 'active', score: 48, stock: 12, trend: [2, 3, 2, 4, 3, 5, 6], updated: ago(7) },
					{ id: '4', name: 'Delta', status: 'archived', score: 78, stock: 60, trend: [5, 5, 6, 5, 7, 6, 7], updated: ago(30) }
				]
			}
		}
	};
}

export function newHeatmapScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Heatmap',
		description: '',
		primitive: 'heatmap',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			matrix: {
				unit: '%',
				xLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
				yLabels: ['Morning', 'Afternoon', 'Evening'],
				values: [
					[20, 35, 28, 41, 30],
					[55, 62, 70, 58, 66],
					[40, 48, 52, 60, 45]
				],
				thresholds: [
					{ at: 0, color: '#14b8a6' },
					{ at: 50, color: '#f5a623' },
					{ at: 80, color: '#f43f5e' }
				]
			}
		}
	};
}

export function newSankeyScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Sankey',
		description: '',
		primitive: 'sankey',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			nodes: [
				{ id: 'source', label: 'Source', color: '#4d7cff' },
				{ id: 'middle-a', label: 'Stage A', color: '#14b8a6' },
				{ id: 'middle-b', label: 'Stage B', color: '#f5a623' },
				{ id: 'sink', label: 'Sink', color: '#a855f7' }
			],
			edges: [
				{ source: 'source', target: 'middle-a', value: 60 },
				{ source: 'source', target: 'middle-b', value: 40 },
				{ source: 'middle-a', target: 'sink', value: 60 },
				{ source: 'middle-b', target: 'sink', value: 40 }
			]
		}
	};
}

export function newTimelineScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Timeline',
		description: '',
		primitive: 'timeline',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			timeline: [
				{
					id: 'track-1',
					label: 'Track A',
					segments: [
						{ start: 0, end: 4, state: 'idle' },
						{ start: 4, end: 7, state: 'running', label: 'Phase 1' },
						{ start: 7, end: 10, state: 'idle' }
					]
				},
				{
					id: 'track-2',
					label: 'Track B',
					segments: [
						{ start: 1, end: 3, state: 'running', label: 'Setup' },
						{ start: 5, end: 9, state: 'success', label: 'Done' }
					]
				}
			]
		}
	};
}

export function newTreemapScene(): SceneDoc {
	const id = newSceneId();
	return {
		id,
		slug: id,
		name: 'Untitled Treemap',
		description: '',
		primitive: 'treemap',
		dimension: '2d',
		boundAdapter: null,
		style: { contentFont: 'sans' },
		data: {
			nodes: [
				{ id: 'root', label: 'Root' },
				{ id: 'group-a', label: 'Group A', color: '#4d7cff' },
				{ id: 'group-b', label: 'Group B', color: '#14b8a6' },
				{ id: 'a1', label: 'A1', value: 40, color: '#4d7cff' },
				{ id: 'a2', label: 'A2', value: 25, color: '#4d7cff' },
				{ id: 'b1', label: 'B1', value: 20, color: '#14b8a6' },
				{ id: 'b2', label: 'B2', value: 15, color: '#14b8a6' }
			],
			edges: [
				{ source: 'root', target: 'group-a' },
				{ source: 'root', target: 'group-b' },
				{ source: 'group-a', target: 'a1' },
				{ source: 'group-a', target: 'a2' },
				{ source: 'group-b', target: 'b1' },
				{ source: 'group-b', target: 'b2' }
			]
		}
	};
}

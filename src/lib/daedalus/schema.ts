// DAEDALUS scene contract.
//
// Everything DAEDALUS renders comes from a SceneDoc, and every data source is
// tailored into VizData — the one canonical shape every primitive consumes.
// A static authored scene = hand-written VizData; a live scene = adapter-produced
// VizData. They are indistinguishable downstream (same renderer, drill-down, export).
// See ref/PRD_DAEDALUS.md.

export type VizPrimitive =
	// structural / topology (read nodes/edges/layers)
	| 'stack'
	| 'graph'
	| 'tree'
	| 'heatmap'
	| 'sankey'
	| 'timeline'
	| 'treemap'
	| 'table'
	// quantitative charts (read scalar/categories/series)
	| 'stat'
	| 'gauge'
	| 'bullet'
	| 'bar'
	| 'pie'
	| 'radar'
	| 'line'
	| 'area'
	| 'scatter';
export type VizDimension = '2d' | '3d';

/** Quantitative-primitive families, grouped by the VizData field they consume. */
export const SCALAR_PRIMITIVES = ['stat', 'gauge', 'bullet'] as const;
export const CATEGORY_PRIMITIVES = ['bar', 'pie'] as const;
export const SERIES_PRIMITIVES = ['line', 'area', 'scatter'] as const;
export const STRUCTURAL_PRIMITIVES = [
	'stack',
	'graph',
	'tree',
	'heatmap',
	'sankey',
	'timeline',
	'treemap',
	'table'
] as const;

export function isChartPrimitive(p: VizPrimitive): boolean {
	return (
		(SCALAR_PRIMITIVES as readonly string[]).includes(p) ||
		(CATEGORY_PRIMITIVES as readonly string[]).includes(p) ||
		(SERIES_PRIMITIVES as readonly string[]).includes(p)
	);
}

/** How a layer/node label is displayed in the 3D scene. */
export type LabelShow = 'always' | 'hover' | 'hidden';
export type LabelAnchor = 'band' | 'left' | 'right' | 'above';

export interface LabelStyle {
	/** always = persistent; hover = only when the object is hovered/selected; hidden = never. */
	show?: LabelShow;
	/** Text size multiplier (1 = default). */
	scale?: number;
	/** Screen-space nudge in px. */
	offsetX?: number;
	offsetY?: number;
	/** Where the label sits relative to the band. */
	anchor?: LabelAnchor;
	/** Hex color override (default: white). */
	color?: string;
}

/** A drill-down link from a layer/node to another scene (C4 zoom levels). */
export interface VizLink {
	/** Target SceneDoc.id to navigate to on drill-in. */
	sceneId: string;
	/** Optional CTA label (default: "Drill into <item label>"). */
	label?: string;
}

/** A boundary container in a Graph — groups the nodes that share VizNode.group. */
export interface VizGroup {
	/** Matches the `group` string on member VizNodes. */
	id: string;
	label: string;
	/** Hex tint for the boundary box + header (default: themed by index). */
	color?: string;
}

/** Edge semantics — drives stroke style + arrow in the Graph renderer. */
export type EdgeKind =
	| 'sync' // synchronous request/response (solid)     — e.g. HTTPS call
	| 'async' // streaming / long-lived channel (dashed)  — e.g. websocket
	| 'event' // fire-and-forget / queue (dotted)         — e.g. webhook, pub/sub
	| 'data' // bulk data / query (thick solid)           — e.g. SQL, storage read
	| 'dep'; // build/runtime dependency (thin, no arrow)

/** A band in a Stack primitive (ordered top → bottom). */
export interface VizLayer {
	id: string;
	label: string;
	/** Hex band color. */
	color: string;
	/** Optional short sublabel rendered under the label. */
	sublabel?: string;
	/** Markdown detail panel shown on drill-down. */
	panel?: string;
	/** Per-layer label display overrides (merged over the scene default). */
	labelStyle?: LabelStyle;
	/** Drill-down: clicking this layer can navigate into another scene. */
	link?: VizLink;
}

/** A node in a Graph/Tree primitive. */
export interface VizNode {
	id: string;
	label: string;
	group?: string;
	value?: number;
	color?: string;
	/** Bound data fields (for live scenes; templated into the panel). */
	data?: Record<string, unknown>;
	panel?: string;
	/** Drill-down: clicking this node can navigate into another scene. */
	link?: VizLink;
}

export interface VizEdge {
	source: string;
	target: string;
	label?: string;
	/** Edge semantics — drives stroke style + arrow. Free strings still allowed. */
	kind?: EdgeKind | string;
	/** Animate a flow indicator along the edge (direction of data movement). */
	animated?: boolean;
	/** Flow magnitude — sets link thickness in the Sankey primitive. */
	value?: number;
}

/** A threshold band: at this value the rendered color switches to `color`. */
export interface VizThreshold {
	at: number;
	color: string;
}

/** A single measured number — read by Stat and Gauge. */
export interface VizScalar {
	value: number;
	/** Unit suffix, e.g. "%", "ms", "GB". */
	unit?: string;
	/** Caption under/above the number. */
	label?: string;
	/** Range for gauges and threshold math (default 0..100). */
	min?: number;
	max?: number;
	/** Optional target/goal marker. */
	target?: number;
	/** Delta vs. a previous value (Stat trend arrow); positive = up. */
	delta?: number;
	/** Higher value is good? Flips delta arrow coloring. Default true. */
	higherIsBetter?: boolean;
	/** Ascending threshold bands; the highest `at` <= value wins for coloring. */
	thresholds?: VizThreshold[];
	/** Recent values for an inline sparkline (Stat). */
	spark?: number[];
}

/** A labeled value — read by Bar (single series) and Pie/Donut. */
export interface VizCategory {
	id: string;
	label: string;
	value: number;
	/** Hex color override (else themed palette by index). */
	color?: string;
}

/** A named line/area over an X axis — read by Line/Area/Scatter and grouped Bar. */
export interface VizSeries {
	id: string;
	name: string;
	color?: string;
	/** Curve style for line/area. step = staircase (discrete state). Default linear. */
	interpolation?: 'linear' | 'step' | 'smooth';
	points: { x: number | string; y: number }[];
}

/** One overlaid polygon in a Radar — a named set of per-axis values. */
export interface VizRadarSeries {
	id: string;
	name: string;
	/** Hex color override (else themed palette by index; first series defaults to the mode primary). */
	color?: string;
	/** One value per axis (index-aligned with VizRadar.axes). */
	values: number[];
}

/** Spider/radar data — N axes, one or more overlaid series. Read by the Radar primitive. */
export interface VizRadar {
	/** Axis labels around the N-gon (one spoke each). */
	axes: string[];
	/** Overlaid series; each carries one value per axis. */
	series: VizRadarSeries[];
	/** Outer-ring value. Defaults to the data max (or 5) when unset. */
	max?: number;
}

/**
 * How a Table cell renders its column's value.
 * Tier-1 set: text/number/badge/sparkline/heat/bar/link/date (original) plus
 * currency/tags/boolean/avatar/mono/color-swatch (additive). All optional —
 * an unset type behaves exactly as before.
 */
export type CellType =
	| 'text'
	| 'number'
	| 'badge'
	| 'sparkline'
	| 'heat'
	| 'bar'
	| 'link'
	| 'date'
	| 'currency'
	| 'tags'
	| 'boolean'
	| 'avatar'
	| 'mono'
	| 'color-swatch';

/** A Table column definition (presentation + how the cell renders). */
export interface VizColumn {
	key: string;
	label: string;
	/** Cell renderer. Default 'text' (or 'number' when values are numeric). */
	type?: CellType;
	/** Unit suffix for number/bar/heat cells, e.g. "%", "ms", "$". */
	unit?: string;
	align?: 'left' | 'right' | 'center';
	/** Column width — px number or any CSS width. */
	width?: number | string;
	/** Default true. */
	sortable?: boolean;
	/** Hide without deleting (user toggle). */
	hidden?: boolean;
	/** number/heat/bar: threshold bands color the text (number) or fill (heat/bar). */
	thresholds?: VizThreshold[];
	/** badge: value → { label?, color } pill mapping. */
	badgeMap?: Record<string, { label?: string; color: string }>;
	/** bar: denominator (else the column max). */
	max?: number;
	/** sparkline: the row field holding number[] (defaults to this column's key). */
	sparkKey?: string;
	/** link: href template with {key} placeholders, e.g. "/clients/{id}". */
	href?: string;
	/** date: how to format an ISO/epoch value. */
	dateFormat?: 'date' | 'datetime' | 'relative';

	// --- SHARED flags (orthogonal to type) ---
	/** Truncate overflow to a single line with ellipsis + title tooltip (any cell). */
	truncate?: boolean;
	/** Numeric display style for number/currency cells. Default 'plain' (compact for number). */
	numberFormat?: 'compact' | 'percent' | 'plain';
	/** Override the empty-value fallback ('·'/'') for this column. */
	emptyText?: string;

	// --- LINK fields ---
	/** link: force opening in a new tab (else auto-detected for absolute/protocol URLs). */
	external?: boolean;
	/** link: anchor target. Default '_self' (or '_blank' when external). */
	target?: '_self' | '_blank';

	// --- currency ---
	/** ISO 4217 code, e.g. "USD", "EUR". Default 'USD'. */
	currency?: string;
	/** BCP-47 locale for formatting, e.g. "en-US". Default 'en-US'. */
	locale?: string;
	/** Whether the raw value is in dollars or cents (cents → divided by 100). Default 'dollars'. */
	currencyScale?: 'dollars' | 'cents';
	/** Color positive green / negative red. */
	signColor?: boolean;
	/** Prefix a '+' on positive values. */
	signPrefix?: boolean;

	// --- tags ---
	/** tags: value → { label?, color } pill mapping. */
	tagMap?: Record<string, { label?: string; color: string }>;
	/** tags: cap the number of pills shown; the rest collapse to a "+N" pill. */
	maxTags?: number;

	// --- boolean ---
	/** How a boolean renders. Default 'check'. */
	boolStyle?: 'check' | 'dot' | 'yesno' | 'text';
	/** Color for the truthy state. Default green. */
	trueColor?: string;
	/** Color for the falsey state. Default zinc. */
	falseColor?: string;
	/** Render nothing (blank) for falsey values. */
	falseHidden?: boolean;

	// --- avatar ---
	/** Row field holding the image URL (defaults to this column's key). */
	imgKey?: string;
	/** Row field holding the alt text. */
	altKey?: string;
	/** Row field holding the initials/fallback source when the image is missing. */
	fallbackKey?: string;
	/** Prefix prepended to the image URL (e.g. a CDN base). */
	imgPrefix?: string;
	/** Avatar shape. Default 'circle'. */
	shape?: 'circle' | 'square';
	/** Avatar size in px. Default 24. */
	size?: number;

	// --- color-swatch ---
	/** Swatch shape. Default 'square'. */
	swatchShape?: 'circle' | 'square';
	/** Show the raw color value beside the swatch. */
	showLabel?: boolean;
}

/** A per-row action button (serializable capability; the handler is a component prop). */
export interface VizRowAction {
	id: string;
	label: string;
	/** lucide icon name (resolved against the renderer's bounded registry). */
	icon?: string;
	variant?: 'default' | 'primary' | 'danger' | 'ghost';
	/** Row field whose truthy value disables this action for that row. */
	disabledKey?: string;
}

/** Tabular data — read by the Table primitive. */
export interface VizTabular {
	columns: VizColumn[];
	rows: Record<string, unknown>[];
	/** Row field used as the stable key (defaults to 'id' or row index). */
	rowKey?: string;
	/** Make the whole row a link; href template with {key} placeholders. */
	rowHref?: string;
	/** rowHref: open in a new tab (else auto-detected). */
	rowExternal?: boolean;
	/** What a row click does. Default 'navigate' when rowHref is set. */
	rowAction?: 'navigate' | 'dialog';
	/** Per-row action buttons rendered in a trailing actions cell. */
	rowActions?: VizRowAction[];
}

/** A 2D matrix of values — read by the Heatmap primitive. */
export interface VizMatrix {
	/** Column labels (x axis). */
	xLabels: string[];
	/** Row labels (y axis). */
	yLabels: string[];
	/** Row-major grid: values[y][x]. null = empty cell (no tile). */
	values: (number | null)[][];
	/** Unit suffix for the cell value, e.g. "%", "ms". */
	unit?: string;
	/** Ascending threshold bands — the highest `at` <= value wins for the tile fill. */
	thresholds?: VizThreshold[];
}

/** A single state span on a timeline track. */
export interface VizTimelineSegment {
	/** Start/end as epoch ms, ISO string, or a numeric position. */
	start: number | string;
	end: number | string;
	/** Optional state key (drives color via the track/scene palette). */
	state?: string;
	label?: string;
	/** Hex color override for this span. */
	color?: string;
}

/** A labeled row of state-over-time spans — read by the Timeline primitive. */
export interface VizTimelineTrack {
	id: string;
	label: string;
	segments: VizTimelineSegment[];
}

/** The canonical shape every primitive reads and every adapter produces. */
export interface VizData {
	// --- structural / topology (stack, graph, tree, heatmap) ---
	nodes?: VizNode[];
	edges?: VizEdge[];
	/** Ordered layers, for the Stack primitive. */
	layers?: VizLayer[];
	/** Boundary containers (Graph) — grouped by VizNode.group === VizGroup.id. */
	groups?: VizGroup[];
	// --- quantitative (charts) ---
	/** Single number — Stat, Gauge. */
	scalar?: VizScalar;
	/** Labeled values — Bar (single), Pie/Donut. */
	categories?: VizCategory[];
	/** Named series over X — Line, Area, grouped Bar. */
	series?: VizSeries[];
	/** N axes + overlaid series — Radar (spider). */
	radar?: VizRadar;
	/** Columns + rows — Table. */
	tabular?: VizTabular;
	/** 2D value grid — Heatmap. */
	matrix?: VizMatrix;
	/** State-over-time tracks — Timeline. */
	timeline?: VizTimelineTrack[];
	// Sankey reads nodes + edges (edge.value = flow); Treemap reads nodes (value) + edges (parent→child).
	meta?: Record<string, unknown>;
}

/** 3D environment settings for the Stack primitive — lighting, material, camera, controls. */
export interface SceneEnvironment {
	ambientIntensity?: number; // default 0.7
	keyIntensity?: number; // default 1.05
	metalness?: number; // 0–1, default 0.12
	roughness?: number; // 0–1, default 0.5
	cameraFov?: number; // degrees, default 42
	damping?: number; // orbit-control smoothing, default 0.1
	autoRotate?: boolean; // slow idle spin, default false
	// --- view / render mode ---
	wireframe?: boolean; // render meshes as wireframe, default false
	showGrid?: boolean; // faint engineering-grid backdrop, default true
}

export interface SceneStyle {
	/**
	 * Visualization-content font tier — deliberately separate from the mode
	 * chrome's drafting typography so exports stay clean and legible.
	 */
	contentFont?: 'sans' | 'mono' | 'serif';
	accent?: string;
	background?: string;
	/** Scene-wide label defaults; per-layer labelStyle overrides these. */
	defaultLabelStyle?: LabelStyle;
	/** 3D environment (Stack primitive). */
	environment?: SceneEnvironment;
	/** Line/Area: stack series cumulatively (composition over X). */
	stacked?: boolean;
	/** Line/Area: render a dot at each data point. */
	showDots?: boolean;
	/** Table presentation options (user-editable). */
	table?: TableStyle;
}

/** Table presentation options. */
export interface TableStyle {
	/** Row height / padding. Default 'comfortable'. */
	density?: 'compact' | 'comfortable';
	/** Zebra striping. Default true. */
	striped?: boolean;
	/** Narrow-screen behavior: stacked cards (default) or horizontal scroll. */
	mobileLayout?: 'cards' | 'scroll';

	// --- SERIALIZABLE interaction capabilities (handlers stay as component props) ---
	/** Add a leading checkbox column for row selection. */
	selectable?: boolean;
	/** Add an internal search box that filters rows. */
	searchable?: boolean;
	/** Row fields to search (default: all text/link/mono columns). */
	searchKeys?: string[];
	/** Client-side pagination: rows per page (0/undefined = no paging). */
	pageSize?: number;
	/** Initial sort applied on first render. */
	defaultSort?: { key: string; dir: 'asc' | 'desc' };
	/** Mark rows as clickable (cursor/affordance) even without rowHref. */
	rowClickable?: boolean;
}

export interface SceneDoc {
	id: string;
	slug: string;
	name: string;
	description?: string;
	primitive: VizPrimitive;
	dimension: VizDimension;
	data: VizData;
	style?: SceneStyle;
	/** null/undefined = static authored; else a server-side adapter id (live). */
	boundAdapter?: string | null;
	/** Library folder path ('' or undefined = root, 'infra/dashboards' = nested). */
	folder?: string;
}

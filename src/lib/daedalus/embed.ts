// Build transient (unsaved) SceneDocs from a tab's in-memory data, for the
// "View in DAEDALUS" embed. These scenes are never persisted — they exist only
// for the dialog preview (and its PNG/PDF export). For a durable scene, author
// it in the Studio instead.
import type {
	SceneDoc,
	VizPrimitive,
	VizScalar,
	VizCategory,
	VizSeries,
	VizRadar,
	VizRadarSeries,
	VizNode,
	VizEdge,
	VizLayer,
	VizColumn,
	VizTabular,
	TableStyle
} from './schema';

export interface BuildSceneInput {
	name: string;
	primitive: VizPrimitive;
	description?: string;
	scalar?: VizScalar;
	categories?: VizCategory[];
	series?: VizSeries[];
	radar?: VizRadar;
	nodes?: VizNode[];
	edges?: VizEdge[];
	layers?: VizLayer[];
	tabular?: VizTabular;
	contentFont?: 'sans' | 'mono' | 'serif';
	stacked?: boolean;
	table?: TableStyle;
}

export function buildScene(input: BuildSceneInput): SceneDoc {
	const id = `embed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	return {
		id,
		slug: id,
		name: input.name,
		description: input.description ?? '',
		primitive: input.primitive,
		dimension: input.primitive === 'stack' ? '3d' : '2d',
		boundAdapter: null,
		style: { contentFont: input.contentFont ?? 'sans', stacked: input.stacked, table: input.table },
		data: {
			scalar: input.scalar,
			categories: input.categories,
			series: input.series,
			radar: input.radar,
			nodes: input.nodes,
			edges: input.edges,
			layers: input.layers,
			tabular: input.tabular
		}
	};
}

type CatInput = { label: string; value: number; color?: string };
function toCategories(items: CatInput[]): VizCategory[] {
	return items.map((it, i) => ({ id: `c${i}`, label: it.label, value: it.value, color: it.color }));
}

/** Bar chart from labeled values. */
export function barScene(name: string, items: CatInput[], description?: string): SceneDoc {
	return buildScene({ name, primitive: 'bar', categories: toCategories(items), description });
}

/** Pie/donut from labeled values. */
export function pieScene(name: string, items: CatInput[], description?: string): SceneDoc {
	return buildScene({ name, primitive: 'pie', categories: toCategories(items), description });
}

/** Line (or area) from named series of {x,y} points. */
export function lineScene(
	name: string,
	series: { name: string; color?: string; points: { x: number | string; y: number }[] }[],
	opts?: { area?: boolean; stacked?: boolean; description?: string }
): SceneDoc {
	return buildScene({
		name,
		primitive: opts?.area ? 'area' : 'line',
		stacked: opts?.stacked,
		description: opts?.description,
		series: series.map((s, i) => ({ id: `s${i}`, name: s.name, color: s.color, points: s.points }))
	});
}

/** Radar (spider) from N axis labels + one or more overlaid series. */
export function radarScene(
	name: string,
	axes: string[],
	series: { name: string; color?: string; values: number[] }[],
	opts?: { max?: number; description?: string }
): SceneDoc {
	const radar: VizRadar = {
		axes,
		max: opts?.max,
		series: series.map(
			(s, i): VizRadarSeries => ({ id: `s${i}`, name: s.name, color: s.color, values: s.values })
		)
	};
	return buildScene({ name, primitive: 'radar', radar, description: opts?.description });
}

/** Gauge / Bullet / Stat from a single scalar. */
export function scalarScene(
	name: string,
	scalar: VizScalar,
	primitive: 'gauge' | 'bullet' | 'stat' = 'gauge',
	description?: string
): SceneDoc {
	return buildScene({ name, primitive, scalar, description });
}

/** Table from columns + rows. */
export function tableScene(
	name: string,
	columns: VizColumn[],
	rows: Record<string, unknown>[],
	opts?: {
		rowKey?: string;
		table?: TableStyle;
		description?: string;
		rowHref?: string;
		rowExternal?: boolean;
		rowAction?: VizTabular['rowAction'];
		rowActions?: VizTabular['rowActions'];
	}
): SceneDoc {
	return buildScene({
		name,
		primitive: 'table',
		description: opts?.description,
		tabular: {
			columns,
			rows,
			rowKey: opts?.rowKey,
			rowHref: opts?.rowHref,
			rowExternal: opts?.rowExternal,
			rowAction: opts?.rowAction,
			rowActions: opts?.rowActions
		},
		table: opts?.table
	});
}

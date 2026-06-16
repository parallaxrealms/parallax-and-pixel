// DataTable wrapper types — the ergonomic, handler-friendly column/action/link
// shapes a dashboard tab authors. These are a SUPERSET of the serializable
// foundation contract (schema.ts): every presentation + per-type field on
// VizColumn is mirrored here, PLUS wrapper-only fields (live handlers, value
// projector) that never reach the SceneDoc. DataTable.svelte maps these down to
// the serializable VizColumn/VizRowAction/VizTabular before handing them to
// tableScene(). See ref/PRD_DAEDALUS.md.

import type { CellType, VizThreshold } from './schema';

/**
 * A cell-level link. `href` is serialization-safe (forwarded into the scene's
 * VizColumn.href). `onClick` is wrapper-only (a live handler) and is NEVER put
 * on the SceneDoc — see the limitation note in DataTable.svelte's report.
 */
export interface CellLink<Row = Record<string, unknown>> {
	/** href template with {key} placeholders, e.g. "/clients/{id}". Serialization-safe. */
	href?: string;
	/** Wrapper-only click handler. Not serialized; not forwarded to the scene. */
	onClick?: (row: Row) => void;
	/** Force opening in a new tab. */
	external?: boolean;
}

/**
 * A per-row action button. Maps to the serializable VizRowAction (id/label/icon/
 * variant), with `show(row)` and `danger` as wrapper-side conveniences.
 */
export interface RowAction<Row = Record<string, unknown>> {
	id: string;
	label: string;
	/** lucide icon NAME — must match the bounded registry in TableScene.svelte. */
	icon?: string;
	variant?: 'default' | 'primary' | 'danger' | 'ghost';
	/** Convenience: treated as variant 'danger' when no explicit variant is set. */
	danger?: boolean;
	/** Wrapper-only predicate: hide/disable this action per row. Not serializable. */
	show?: (row: Row) => boolean;
}

/**
 * A DataTable column — the ergonomic superset of VizColumn. Mirrors every
 * presentation + per-type field on VizColumn (with `cellType` as the friendlier
 * alias of VizColumn.type), and adds wrapper-only fields: `link` (cell links +
 * onClick), `value` (a row→cell projector materialized before serialization),
 * plus link-shorthand `external`/`target`.
 */
export interface ColumnDef<Row = Record<string, unknown>> {
	key: string;
	label: string;
	/** Friendly alias of VizColumn.type. Default 'text' (or 'number' for numeric values). */
	cellType?: CellType;
	/** Unit suffix for number/bar/heat cells, e.g. "%", "ms", "$". */
	unit?: string;
	align?: 'left' | 'right' | 'center';
	/** Column width — px number or any CSS width. */
	width?: number | string;
	/** Default true. */
	sortable?: boolean;
	/** Hide without deleting. */
	hidden?: boolean;
	/** number/heat/bar: threshold bands color the text/fill. */
	thresholds?: VizThreshold[];
	/** badge: value → { label?, color } pill mapping. */
	badgeMap?: Record<string, { label?: string; color: string }>;
	/** bar: denominator (else the column max). */
	max?: number;
	/** sparkline: the row field holding number[] (defaults to this column's key). */
	sparkKey?: string;
	/** date: how to format an ISO/epoch value. */
	dateFormat?: 'date' | 'datetime' | 'relative';

	// --- SHARED flags (orthogonal to type) ---
	/** Truncate overflow to one line with ellipsis + title tooltip. */
	truncate?: boolean;
	/** Numeric display style for number/currency cells. */
	numberFormat?: 'compact' | 'percent' | 'plain';
	/** Override the empty-value fallback for this column. */
	emptyText?: string;

	// --- currency ---
	/** ISO 4217 code, e.g. "USD". Default 'USD'. */
	currency?: string;
	/** BCP-47 locale, e.g. "en-US". Default 'en-US'. */
	locale?: string;
	/** Raw value is dollars or cents (cents → /100). Default 'dollars'. */
	currencyScale?: 'dollars' | 'cents';
	/** Color positive green / negative red. */
	signColor?: boolean;
	/** Prefix a '+' on positive values. */
	signPrefix?: boolean;

	// --- tags ---
	/** tags: value → { label?, color } pill mapping. */
	tagMap?: Record<string, { label?: string; color: string }>;
	/** tags: cap pills shown; rest collapse to "+N". */
	maxTags?: number;

	// --- boolean ---
	/** How a boolean renders. Default 'check'. */
	boolStyle?: 'check' | 'dot' | 'yesno' | 'text';
	/** Color for the truthy state. Default green. */
	trueColor?: string;
	/** Color for the falsey state. Default zinc. */
	falseColor?: string;
	/** Render nothing for falsey values. */
	falseHidden?: boolean;

	// --- avatar ---
	/** Row field holding the image URL (defaults to this column's key). */
	imgKey?: string;
	/** Row field holding the alt text. */
	altKey?: string;
	/** Row field holding the initials/fallback source. */
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

	// --- wrapper-only (NOT serialized into VizColumn) ---
	/** Cell link config. `href`/`external` forward to the scene; `onClick` is wrapper-only. */
	link?: CellLink<Row>;
	/** Row → cell-value projector. Materialized into a plain value before serialization. */
	value?: (row: Row) => unknown;
	/** Link shorthand: force a new tab (forwarded to VizColumn.external). */
	external?: boolean;
	/** Link shorthand: anchor target (forwarded to VizColumn.target). */
	target?: '_self' | '_blank';
}

<script lang="ts">
	/**
	 * DataTable — the ergonomic, handler-friendly wrapper a dashboard tab imports
	 * to render a native inline DAEDALUS table. It is the ONLY thing a tab needs:
	 * author ColumnDef[] (a superset of VizColumn) + rows, wire onRowClick/onAction,
	 * and this builds the ephemeral SceneDoc and renders TableScene directly.
	 *
	 * It BYPASSES DaedalusViewer/DaedalusView (those stay for saved/Studio scenes)
	 * to avoid a 3-file prop-drill of the interaction handlers. The wrapper div
	 * replicates DaedalusView's `.dv` so the table sizes to its container and
	 * inherits the host mode's theme via --mode-* tokens.
	 *
	 * Serialization boundary: ColumnDef → VizColumn drops wrapper-only fields
	 * (link.onClick, value); columns with value() are MATERIALIZED into a derived,
	 * plain-data rows copy (never mutating the input) so the scene round-trips.
	 * Handlers (onRowClick/onAction) never enter the scene — they're component
	 * props passed straight to TableScene.
	 */
	import type { Snippet } from 'svelte';
	import type { VizColumn, VizRowAction, TableStyle } from './schema';
	import type { ColumnDef, RowAction } from './DataTable.types';
	import { tableScene } from './embed';
	import TableScene from './primitives/TableScene.svelte';

	type Row = Record<string, unknown>;
	type RowCtx = { rowKey: string | number; index: number };

	interface Props {
		columns: ColumnDef<Row>[];
		rows: Row[];
		rowKey?: string;
		actions?: RowAction<Row>[];
		onRowClick?: (row: Row, ctx: RowCtx) => void;
		onAction?: (actionId: string, row: Row, ctx: RowCtx) => void;
		selectable?: boolean;
		selectedKeys?: Set<string | number>;
		searchable?: boolean;
		searchKeys?: string[];
		pageSize?: number;
		defaultSort?: { key: string; dir: 'asc' | 'desc' };
		/** CSS height for the sized wrapper (matches DaedalusView). Default '420px'. */
		height?: string;
		/** Empty-state text (table-wide); per-column emptyText still applies per cell. */
		emptyText?: string;
		/** Reserved: when true, callers can overlay a spinner. Forwarded to the wrapper as a flag. */
		loading?: boolean;
		/** Custom trailing action cell — overrides the serializable rowActions path. */
		actionCell?: Snippet<[Row, RowCtx]>;
		class?: string;
	}
	let {
		columns,
		rows,
		rowKey,
		actions,
		onRowClick,
		onAction,
		selectable,
		selectedKeys = $bindable(),
		searchable,
		searchKeys,
		pageSize,
		defaultSort,
		height = '420px',
		emptyText,
		loading = false,
		actionCell,
		class: className = ''
	}: Props = $props();

	// --- ColumnDef[] → VizColumn[] -------------------------------------------
	// Copy presentation + per-type fields; map cellType→type and the link
	// shorthands (link.href→href, link.external/external→external). DROP the
	// wrapper-only fields (link.onClick, value) so the column is serializable.
	const vizColumns = $derived<VizColumn[]>(
		columns.map((c): VizColumn => {
			const col: VizColumn = {
				key: c.key,
				label: c.label,
				type: c.cellType,
				unit: c.unit,
				align: c.align,
				width: c.width,
				sortable: c.sortable,
				hidden: c.hidden,
				thresholds: c.thresholds,
				badgeMap: c.badgeMap,
				max: c.max,
				sparkKey: c.sparkKey,
				href: c.link?.href,
				dateFormat: c.dateFormat,
				truncate: c.truncate,
				numberFormat: c.numberFormat,
				emptyText: c.emptyText,
				external: c.link?.external ?? c.external,
				target: c.target,
				currency: c.currency,
				locale: c.locale,
				currencyScale: c.currencyScale,
				signColor: c.signColor,
				signPrefix: c.signPrefix,
				tagMap: c.tagMap,
				maxTags: c.maxTags,
				boolStyle: c.boolStyle,
				trueColor: c.trueColor,
				falseColor: c.falseColor,
				falseHidden: c.falseHidden,
				imgKey: c.imgKey,
				altKey: c.altKey,
				fallbackKey: c.fallbackKey,
				imgPrefix: c.imgPrefix,
				shape: c.shape,
				size: c.size,
				swatchShape: c.swatchShape,
				showLabel: c.showLabel
			};
			return col;
		})
	);

	// Columns that carry a value() projector — materialized below.
	const valueCols = $derived(columns.filter((c) => typeof c.value === 'function'));

	// --- Materialize value(row) into a plain, serializable rows copy ----------
	// Never mutate the input. If no column has value(), pass rows through as-is.
	const materializedRows = $derived<Row[]>(
		valueCols.length === 0
			? rows
			: rows.map((row) => {
					const out: Row = { ...row };
					for (const c of valueCols) {
						out[c.key] = c.value!(row);
					}
					return out;
				})
	);

	// --- RowAction[] → VizRowAction[] ----------------------------------------
	// id/label/icon/variant are serializable. RowAction.danger collapses into
	// variant 'danger'. RowAction.show() is wrapper-only and NOT representable in
	// the serializable rowActions config — see the limitation note in the report;
	// when any action defines show(), prefer the actionCell snippet path instead.
	const hasConditionalActions = $derived((actions ?? []).some((a) => typeof a.show === 'function'));
	const vizRowActions = $derived<VizRowAction[] | undefined>(
		actions && actions.length > 0
			? actions.map((a) => ({
					id: a.id,
					label: a.label,
					icon: a.icon,
					variant: a.variant ?? (a.danger ? 'danger' : undefined)
				}))
			: undefined
	);

	// Serializable interaction caps for TableStyle.
	const tableStyleCaps = $derived<TableStyle>({
		selectable,
		searchable,
		searchKeys,
		pageSize,
		defaultSort
	});

	// --- Build the ephemeral scene -------------------------------------------
	// Handlers NEVER go into the scene. rowActions go through the serializable
	// path UNLESS a custom actionCell is supplied or any action is conditional
	// (then the snippet path renders them instead).
	const useSnippetActions = $derived(!!actionCell || hasConditionalActions);
	const scene = $derived(
		tableScene(emptyText ?? 'Table', vizColumns, materializedRows, {
			rowKey,
			rowActions: useSnippetActions ? undefined : vizRowActions,
			table: tableStyleCaps
		})
	);

	// The built tabular + style the renderer reads (kept in sync with `scene`).
	const tabular = $derived(scene.data.tabular ?? { columns: [], rows: [] });
	const tableStyle = $derived(scene.style?.table);
	const contentFont = $derived(scene.style?.contentFont ?? 'sans');
</script>

<div class="dv {className}" class:loading style="height: {height};">
	<TableScene
		{tabular}
		{tableStyle}
		{contentFont}
		{onRowClick}
		{onAction}
		bind:selectedKeys
		{actionCell}
	/>
</div>

<style>
	/* Replicates DaedalusView's `.dv` wrapper: full-width, the given height, and a
	   flex child that fills it. --mode-* tokens inherit from the host so the table
	   adopts the surrounding mode's theme. */
	.dv {
		width: 100%;
		display: flex;
		min-height: 0;
	}
	.dv > :global(*) {
		flex: 1;
		min-width: 0;
	}
	.dv.loading {
		opacity: 0.6;
		pointer-events: none;
	}
</style>

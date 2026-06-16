<script lang="ts">
	/**
	 * TableScene — the Table primitive. An HTML/CSS table (not SVG, so it can wrap
	 * text + scroll) with rich cell renderers (badge / sparkline / heat / bar / link
	 * / date / currency / tags / boolean / avatar / mono / color-swatch) reusing the
	 * chart helpers. Responsive: a real table on md+, stacked cards on mobile.
	 * Themed via --mode-* tokens so it adopts the host mode when embedded inline, or
	 * cobalt inside the DAEDALUS dialog.
	 *
	 * Capabilities live on the (serializable) SceneDoc: cell types, column config,
	 * and the interaction caps in TableStyle (selectable/searchable/pageSize/...).
	 * Handlers are NON-serializable component props (onRowClick/onAction/…) and are
	 * never stored on the SceneDoc. With no new props and no new caps, output is
	 * byte-identical to the original renderer.
	 */
	import type { VizColumn, VizTabular, TableStyle, VizRowAction } from '../schema';
	import { formatNumber, scalarColor, rangeFraction, sparklinePath, CONTENT_FONT } from '../chart-utils';
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		Edit,
		Plus,
		Minus,
		Trash2,
		ShoppingBag,
		Eye,
		ExternalLink,
		Check,
		X,
		ChevronRight
	} from 'lucide-svelte';

	type Row = Record<string, unknown>;
	type RowCtx = { rowKey: string | number; index: number };

	interface Props {
		tabular: VizTabular;
		tableStyle?: TableStyle;
		contentFont?: 'sans' | 'mono' | 'serif';
		// --- interaction handlers (non-serializable; never on the SceneDoc) ---
		onRowClick?: (row: Row, ctx: RowCtx) => void;
		onAction?: (actionId: string, row: Row, ctx: RowCtx) => void;
		selectedKeys?: Set<string | number>;
		onSelectionChange?: (keys: Set<string | number>) => void;
		actionCell?: Snippet<[Row, RowCtx]>;
	}
	let {
		tabular,
		tableStyle,
		contentFont = 'sans',
		onRowClick,
		onAction,
		selectedKeys = $bindable(),
		onSelectionChange,
		actionCell
	}: Props = $props();

	// Bounded lucide icon registry (name → component). Unknown name → no icon.
	// Typed by an actual icon: lucide-svelte components don't satisfy svelte's
	// generic `Component<{}, {}, string>`, but they're mutually structural.
	const ICONS: Record<string, typeof Edit> = {
		Edit,
		Plus,
		Minus,
		Trash2,
		ShoppingBag,
		Eye,
		ExternalLink,
		Check,
		X,
		ChevronRight
	};

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);
	const density = $derived(tableStyle?.density ?? 'comfortable');
	const striped = $derived(tableStyle?.striped ?? true);
	const mobileLayout = $derived(tableStyle?.mobileLayout ?? 'cards');
	const cols = $derived((tabular.columns ?? []).filter((c) => !c.hidden));
	const allRows = $derived(tabular.rows ?? []);
	const cellPad = $derived(density === 'compact' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-[0.82rem]');

	// --- serializable interaction caps ---
	const selectable = $derived(tableStyle?.selectable ?? false);
	const searchable = $derived(tableStyle?.searchable ?? false);
	const pageSize = $derived(tableStyle?.pageSize ?? 0);
	const rowActions = $derived(tabular.rowActions ?? []);
	const hasActionsCol = $derived(rowActions.length > 0 || !!actionCell);
	const rowClickable = $derived(!!onRowClick || tableStyle?.rowClickable === true || !!tabular.rowHref);

	function get(row: Row, key: string): unknown {
		if (key in row) return row[key];
		return key.split('.').reduce<unknown>((acc, k) => (acc == null ? acc : (acc as any)[k]), row);
	}
	function rowKeyOf(row: Row, i: number): string | number {
		return tabular.rowKey ? (get(row, tabular.rowKey) as string | number) ?? i : i;
	}

	// Per-column max for bar cells.
	const colMax = $derived.by(() => {
		const m: Record<string, number> = {};
		for (const c of cols) {
			if (c.type === 'bar') {
				m[c.key] = c.max ?? Math.max(1, ...allRows.map((r) => Number(get(r, c.key)) || 0));
			}
		}
		return m;
	});

	// Which columns are text-ish for the default search scope.
	const searchableKeys = $derived.by(() => {
		if (tableStyle?.searchKeys && tableStyle.searchKeys.length) return tableStyle.searchKeys;
		return cols
			.filter((c) => !c.type || c.type === 'text' || c.type === 'link' || c.type === 'mono')
			.map((c) => c.key);
	});

	// --- sort state (defaultSort seeds the initial sort) ---
	// untrack: a one-time seed from the prop; later prop changes must not clobber
	// the user's interactive sort choice.
	let sortKey = $state<string | null>(untrack(() => tableStyle?.defaultSort?.key) ?? null);
	let sortDir = $state<'asc' | 'desc'>(untrack(() => tableStyle?.defaultSort?.dir) ?? 'asc');
	function toggleSort(c: VizColumn) {
		if (c.sortable === false) return;
		if (sortKey !== c.key) {
			sortKey = c.key;
			sortDir = 'asc';
		} else if (sortDir === 'asc') {
			sortDir = 'desc';
		} else {
			sortKey = null;
		}
	}

	// --- search state ---
	let query = $state('');

	// Derived pipeline: rows -> filter -> sort -> page-slice.
	const filteredRows = $derived.by(() => {
		if (!searchable || !query.trim()) return allRows;
		const q = query.trim().toLowerCase();
		const keys = searchableKeys;
		return allRows.filter((r) => keys.some((k) => String(get(r, k) ?? '').toLowerCase().includes(q)));
	});
	const sortedRows = $derived.by(() => {
		if (!sortKey) return filteredRows;
		const dir = sortDir === 'desc' ? -1 : 1;
		return [...filteredRows].sort((a, b) => {
			const av = get(a, sortKey!);
			const bv = get(b, sortKey!);
			if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
			return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true }) * dir;
		});
	});

	// --- pagination ---
	let page = $state(0);
	const pageCount = $derived(pageSize > 0 ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1);
	// Clamp at read time (a derived) rather than mutating `page` from an effect —
	// keeps the page in range when the filtered set shrinks without a write-back loop.
	const currentPage = $derived(Math.min(Math.max(0, page), pageCount - 1));
	const pagedRows = $derived.by(() => {
		if (pageSize <= 0) return sortedRows;
		const start = currentPage * pageSize;
		return sortedRows.slice(start, start + pageSize);
	});
	// The rows actually rendered (and what select-all operates over).
	const viewRows = $derived(pagedRows);

	// --- selection ---
	const selectAllChecked = $derived.by(() => {
		if (!selectable || !selectedKeys || viewRows.length === 0) return false;
		return viewRows.every((r, i) => selectedKeys!.has(rowKeyOf(r, i)));
	});
	function commitSelection(next: Set<string | number>) {
		selectedKeys = next;
		onSelectionChange?.(next);
	}
	function toggleRowSel(k: string | number) {
		const next = new SvelteSet(selectedKeys ?? []);
		if (next.has(k)) next.delete(k);
		else next.add(k);
		commitSelection(next);
	}
	function toggleSelectAll() {
		const next = new SvelteSet(selectedKeys ?? []);
		const keys = viewRows.map((r, i) => rowKeyOf(r, i));
		const allOn = keys.every((k) => next.has(k));
		for (const k of keys) {
			if (allOn) next.delete(k);
			else next.add(k);
		}
		commitSelection(next);
	}

	function linkHref(col: VizColumn, row: Row): string {
		return (col.href ?? '').replace(/\{(\w+)\}/g, (_, k) => String(get(row, k) ?? ''));
	}
	function interpolate(tpl: string, row: Row): string {
		return tpl.replace(/\{(\w+)\}/g, (_, k) => String(get(row, k) ?? ''));
	}
	const ABS_URL = /^(https?:|mailto:|tel:)/;
	function isExternalHref(href: string, explicit?: boolean): boolean {
		return explicit === true || ABS_URL.test(href);
	}

	// --- row navigation (whole-row link) ---
	const rowNavEnabled = $derived(!!tabular.rowHref);
	function rowHrefOf(row: Row): string {
		return tabular.rowHref ? interpolate(tabular.rowHref, row) : '';
	}
	function rowTarget(href: string): '_self' | '_blank' {
		return isExternalHref(href, tabular.rowExternal) ? '_blank' : '_self';
	}

	function emptyFor(col: VizColumn): string {
		return col.emptyText ?? '·';
	}
	function isEmpty(v: unknown): boolean {
		return v == null || v === '';
	}

	function fmtNumberWith(n: number, col: VizColumn): string {
		const nf = col.numberFormat;
		if (nf === 'percent') return `${formatNumber(n)}%`;
		if (nf === 'plain') return String(n);
		return formatNumber(n);
	}

	function fmtCurrency(n: number, col: VizColumn): string {
		const amt = col.currencyScale === 'cents' ? n / 100 : n;
		try {
			return new Intl.NumberFormat(col.locale || 'en-US', {
				style: 'currency',
				currency: col.currency || 'USD'
			}).format(amt);
		} catch {
			return String(amt);
		}
	}

	function asTags(raw: unknown): string[] {
		if (Array.isArray(raw)) return raw.map((v) => String(v));
		if (typeof raw === 'string')
			return raw
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
		return [];
	}

	function fmtDate(v: unknown, f: VizColumn['dateFormat']): string {
		const d = new Date(v as string);
		if (isNaN(+d)) return String(v ?? '');
		if (f === 'datetime') return d.toLocaleString();
		if (f === 'relative') {
			const days = Math.round((Date.now() - +d) / 86400000);
			if (days === 0) return 'today';
			return days > 0 ? `${days}d ago` : `in ${-days}d`;
		}
		return d.toLocaleDateString();
	}

	/** Plain-text value for the CSV/text export path — one branch per cell type. */
	function cellText(col: VizColumn, row: Row): string {
		const raw = get(row, col.key);
		switch (col.type) {
			case 'currency':
				return isEmpty(raw) ? emptyFor(col) : fmtCurrency(Number(raw) || 0, col);
			case 'tags':
				return asTags(raw)
					.map((t) => col.tagMap?.[t]?.label ?? t)
					.join(', ');
			case 'boolean': {
				const truthy = !!raw;
				if (col.falseHidden && !truthy) return '';
				if (col.boolStyle === 'yesno') return truthy ? 'Yes' : 'No';
				if (col.boolStyle === 'dot') return truthy ? '●' : '○';
				if (col.boolStyle === 'text') return String(raw ?? '');
				return truthy ? '✓' : '✗';
			}
			case 'avatar':
				return String(get(row, col.altKey ?? col.fallbackKey ?? col.key) ?? '');
			case 'mono':
				return String(raw ?? '');
			case 'color-swatch':
				return String(raw ?? '');
			case 'number':
			case 'heat':
			case 'bar':
				return isEmpty(raw) ? emptyFor(col) : `${formatNumber(Number(raw) || 0)}${col.unit ?? ''}`;
			case 'date':
				return fmtDate(raw, col.dateFormat);
			case 'sparkline':
				return '';
			default:
				return String(raw ?? '');
		}
	}

	function actionDisabled(action: VizRowAction, row: Row): boolean {
		if (!onAction) return true;
		if (action.disabledKey && get(row, action.disabledKey)) return true;
		return false;
	}
	function actionVariantClass(v: VizRowAction['variant']): string {
		switch (v) {
			case 'primary':
				return 'dt-act-primary';
			case 'danger':
				return 'dt-act-danger';
			case 'ghost':
				return 'dt-act-ghost';
			default:
				return 'dt-act-default';
		}
	}

	export function capturePng(): Promise<string | null> {
		// HTML table — no SVG raster. Export is CSV/print, handled elsewhere.
		return Promise.resolve(null);
	}
</script>

{#snippet cellContent(col: VizColumn, row: Row)}
	{@const raw = get(row, col.key)}
	{#if col.type === 'badge'}
		{@const b = col.badgeMap?.[String(raw)]}
		<span
			class="dt-interactive inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
			class:dt-trunc={col.truncate}
			title={col.truncate ? String(b?.label ?? raw ?? '') : undefined}
			style="color: {b?.color ?? '#cbd5e1'}; border-color: {b?.color ?? '#475569'}55; background: {b?.color ?? '#64748b'}1f;"
		>
			{b?.label ?? String(raw ?? '')}
		</span>
	{:else if col.type === 'sparkline'}
		{@const vals = (get(row, col.sparkKey ?? col.key) as number[]) ?? []}
		{#if vals.length > 1}
			<svg width="68" height="20" viewBox="0 0 68 20" style="display:inline-block; vertical-align:middle;">
				<path d={sparklinePath(vals, 68, 20)} fill="none" stroke="var(--accent-primary, #00a5cf)" stroke-width="1.5" />
			</svg>
		{:else}<span class="text-zinc-600">·</span>{/if}
	{:else if col.type === 'heat'}
		{@const n = Number(raw) || 0}
		<span
			class="inline-block min-w-[2.5rem] px-1.5 py-0.5 text-center"
			style="background: {scalarColor({ value: n, thresholds: col.thresholds }, '#334155')}33; color: {scalarColor({ value: n, thresholds: col.thresholds }, '#cbd5e1')};"
		>
			{isEmpty(raw) ? emptyFor(col) : `${formatNumber(n)}${col.unit ?? ''}`}
		</span>
	{:else if col.type === 'bar'}
		{@const n = Number(raw) || 0}
		<span class="dt-interactive flex items-center gap-1.5">
			<span class="relative h-2 flex-1 overflow-hidden bg-white/[0.06]">
				<span
					class="absolute inset-y-0 left-0"
					style="width: {rangeFraction(n, 0, colMax[col.key] ?? 100) * 100}%; background: {scalarColor({ value: n, thresholds: col.thresholds }, 'var(--accent-primary, #00a5cf)')};"
				></span>
			</span>
			<span class="w-10 text-right text-[0.72rem] text-zinc-300">{formatNumber(n)}{col.unit ?? ''}</span>
		</span>
	{:else if col.type === 'number'}
		<span
			class:dt-trunc={col.truncate}
			title={col.truncate ? cellText(col, row) : undefined}
			style={col.thresholds ? `color: ${scalarColor({ value: Number(raw) || 0, thresholds: col.thresholds }, '#e2e8f0')}` : ''}
		>
			{isEmpty(raw) ? emptyFor(col) : fmtNumberWith(Number(raw), col)}{isEmpty(raw) ? '' : (col.unit ?? '')}
		</span>
	{:else if col.type === 'currency'}
		{@const n = Number(raw) || 0}
		{@const txt = isEmpty(raw) ? emptyFor(col) : (col.signPrefix && n > 0 ? '+' : '') + fmtCurrency(n, col)}
		<span
			class="font-mono"
			class:dt-trunc={col.truncate}
			title={col.truncate ? txt : undefined}
			style={col.signColor && !isEmpty(raw) ? `color: ${n < 0 ? '#f87171' : '#34d399'}` : ''}
		>
			{txt}
		</span>
	{:else if col.type === 'tags'}
		{@const tags = asTags(raw)}
		{@const shown = col.maxTags && col.maxTags > 0 ? tags.slice(0, col.maxTags) : tags}
		{@const overflow = tags.length - shown.length}
		{#if tags.length === 0}
			<span class="text-zinc-600">{emptyFor(col)}</span>
		{:else}
			<span class="dt-interactive flex flex-wrap gap-1">
				{#each shown as t (t)}
					{@const m = col.tagMap?.[t]}
					<span
						class="inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
						style="color: {m?.color ?? '#cbd5e1'}; border-color: {m?.color ?? '#475569'}55; background: {m?.color ?? '#64748b'}1f;"
					>
						{m?.label ?? t}
					</span>
				{/each}
				{#if overflow > 0}
					<span
						class="inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
						style="color: #94a3b8; border-color: #47556955; background: #64748b1f;"
					>
						+{overflow}
					</span>
				{/if}
			</span>
		{/if}
	{:else if col.type === 'boolean'}
		{@const truthy = !!raw}
		{@const style = col.boolStyle ?? 'check'}
		{@const tc = col.trueColor ?? '#34d399'}
		{@const fc = col.falseColor ?? '#71717a'}
		{#if col.falseHidden && !truthy}
			<span></span>
		{:else if style === 'dot'}
			<span
				class="inline-block h-2.5 w-2.5 rounded-full align-middle"
				style="background: {truthy ? tc : fc};"
				aria-label={truthy ? 'yes' : 'no'}
				title={truthy ? 'yes' : 'no'}
			></span>
		{:else if style === 'yesno'}
			<span style="color: {truthy ? tc : fc};">{truthy ? 'Yes' : 'No'}</span>
		{:else if style === 'text'}
			<span style="color: {truthy ? tc : fc};">{String(raw ?? '')}</span>
		{:else}
			<span style="color: {truthy ? tc : fc};" aria-label={truthy ? 'true' : 'false'} title={truthy ? 'true' : 'false'}>
				{truthy ? '✓' : '✗'}
			</span>
		{/if}
	{:else if col.type === 'avatar'}
		{@const url = isEmpty(get(row, col.imgKey ?? col.key)) ? '' : (col.imgPrefix ?? '') + String(get(row, col.imgKey ?? col.key))}
		{@const sz = col.size ?? 24}
		{@const round = (col.shape ?? 'circle') === 'circle'}
		{@const alt = String(get(row, col.altKey ?? col.key) ?? '')}
		{@const initial = String(get(row, col.fallbackKey ?? col.key) ?? '').charAt(0).toUpperCase()}
		{#if url}
			<img
				src={url}
				{alt}
				width={sz}
				height={sz}
				class="dt-interactive inline-block object-cover align-middle"
				style="width:{sz}px;height:{sz}px;border-radius:{round ? '9999px' : '4px'};"
			/>
		{:else}
			<span
				class="inline-flex items-center justify-center align-middle text-[10px] font-semibold"
				style="width:{sz}px;height:{sz}px;border-radius:{round ? '9999px' : '4px'};background:var(--accent-primary,#00a5cf)33;color:#cbd5e1;"
				title={alt}
				aria-label={alt}
			>
				{initial || '?'}
			</span>
		{/if}
	{:else if col.type === 'mono'}
		<span class="font-mono" class:dt-trunc={col.truncate} title={col.truncate ? String(raw ?? '') : undefined}>
			{isEmpty(raw) ? emptyFor(col) : String(raw)}
		</span>
	{:else if col.type === 'color-swatch'}
		{@const c = String(raw ?? '')}
		{#if isEmpty(raw)}
			<span class="text-zinc-600">{emptyFor(col)}</span>
		{:else}
			<span class="inline-flex items-center gap-1.5 align-middle">
				<span
					class="inline-block h-3.5 w-3.5 border border-white/20 align-middle"
					style="background:{c};border-radius:{(col.swatchShape ?? 'square') === 'circle' ? '9999px' : '3px'};"
					title={c}
				></span>
				{#if col.showLabel}<span class="font-mono text-[0.72rem]">{c}</span>{/if}
			</span>
		{/if}
	{:else if col.type === 'date'}
		<span class:dt-trunc={col.truncate} title={col.truncate ? cellText(col, row) : undefined}>{fmtDate(raw, col.dateFormat)}</span>
	{:else if col.type === 'link'}
		{@const href = linkHref(col, row)}
		{@const ext = isExternalHref(href, col.external)}
		{#if ext}
			<a
				class="dt-interactive dt-link inline-flex items-center gap-0.5 text-[var(--accent-primary,#00a5cf)] hover:underline"
				class:dt-trunc={col.truncate}
				title={col.truncate ? String(raw ?? '') : undefined}
				{href}
				target={col.target ?? '_blank'}
				rel="noopener noreferrer"
			>
				{String(raw ?? '')}
				<ExternalLink size={11} class="dt-extglyph" />
			</a>
		{:else}
			<a
				class="dt-interactive dt-link text-[var(--accent-primary,#00a5cf)] hover:underline"
				class:dt-trunc={col.truncate}
				title={col.truncate ? String(raw ?? '') : undefined}
				{href}
				target={col.target ?? '_self'}
			>
				{String(raw ?? '')}
			</a>
		{/if}
	{:else}
		<span class:dt-trunc={col.truncate} title={col.truncate ? String(raw ?? '') : undefined}>
			{isEmpty(raw) ? emptyFor(col) : String(raw)}
		</span>
	{/if}
{/snippet}

{#snippet actionButtons(row: Row, ctx: RowCtx)}
	{#each rowActions as a (a.id)}
		{@const Icon = a.icon ? ICONS[a.icon] : undefined}
		<button
			type="button"
			class="dt-act {actionVariantClass(a.variant)}"
			title={a.label}
			aria-label={a.label}
			disabled={actionDisabled(a, row)}
			onclick={(e) => {
				e.stopPropagation();
				onAction?.(a.id, row, ctx);
			}}
		>
			{#if Icon}<Icon size={13} />{/if}
			<span class="dt-act-label">{a.label}</span>
		</button>
	{/each}
{/snippet}

<div class="dt-root" class:cards={mobileLayout === 'cards'} style="font-family: {font};">
	{#if searchable}
		<div class="dt-toolbar">
			<input
				class="dt-search"
				type="search"
				placeholder="Search…"
				bind:value={query}
				oninput={() => (page = 0)}
			/>
		</div>
	{/if}

	<!-- Desktop / tablet: real table -->
	<div class="dt-scroll">
		<table class="w-full border-collapse">
			<thead>
				<tr>
					{#if selectable}
						<th class="dt-th dt-selcol {cellPad}">
							<input
								type="checkbox"
								aria-label="Select all"
								checked={selectAllChecked}
								onclick={(e) => e.stopPropagation()}
								onchange={toggleSelectAll}
							/>
						</th>
					{/if}
					{#each cols as c (c.key)}
						<th
							class="dt-th {cellPad} {c.sortable === false ? '' : 'cursor-pointer'}"
							style="text-align:{c.align ?? 'left'};{c.width ? ` width:${typeof c.width === 'number' ? c.width + 'px' : c.width}` : ''}"
							onclick={() => toggleSort(c)}
						>
							<span class="inline-flex items-center gap-1">
								{c.label}
								{#if sortKey === c.key}<span class="text-[var(--accent-primary,#00a5cf)]">{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
							</span>
						</th>
					{/each}
					{#if hasActionsCol}
						<th class="dt-th dt-actcol {cellPad}" style="text-align:right">&nbsp;</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each viewRows as row, i (rowKeyOf(row, i))}
					{@const rk = rowKeyOf(row, i)}
					{@const ctx = { rowKey: rk, index: i }}
					{@const rhref = rowNavEnabled ? rowHrefOf(row) : ''}
					<tr
						class="dt-row {striped && i % 2 === 1 ? 'dt-striped' : ''}"
						class:dt-rownav={rowNavEnabled || rowClickable}
						class:dt-clickable={rowClickable}
						role={onRowClick ? 'button' : undefined}
						tabindex={onRowClick ? 0 : undefined}
						onclick={onRowClick ? () => onRowClick(row, ctx) : undefined}
						onkeydown={onRowClick
							? (e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onRowClick(row, ctx);
									}
								}
							: undefined}
					>
						{#if selectable}
							<td class="dt-td dt-selcol {cellPad}">
								<input
									type="checkbox"
									aria-label="Select row"
									checked={!!selectedKeys?.has(rk)}
									onclick={(e) => e.stopPropagation()}
									onchange={() => toggleRowSel(rk)}
								/>
							</td>
						{/if}
						{#each cols as c, ci (c.key)}
							<td class="dt-td {cellPad}" style="text-align:{c.align ?? 'left'}">
								{#if rowNavEnabled && rhref && ci === 0 && c.type !== 'link'}
									<a
										class="dt-rowlink"
										href={rhref}
										target={rowTarget(rhref)}
										rel={rowTarget(rhref) === '_blank' ? 'noopener noreferrer' : undefined}
										aria-label="Open row"
										tabindex="-1"
									></a>
								{/if}
								{@render cellContent(c, row)}
							</td>
						{/each}
						{#if hasActionsCol}
							<td class="dt-td dt-actcol {cellPad}" style="text-align:right">
								<span class="dt-act-wrap" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
									{#if actionCell}{@render actionCell(row, ctx)}{:else}{@render actionButtons(row, ctx)}{/if}
								</span>
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Narrow container: stacked cards (unless mobileLayout = scroll) -->
	{#if mobileLayout === 'cards'}
		<div class="dt-cards">
			{#each viewRows as row, i (rowKeyOf(row, i))}
				{@const rk = rowKeyOf(row, i)}
				{@const ctx = { rowKey: rk, index: i }}
				{@const rhref = rowNavEnabled ? rowHrefOf(row) : ''}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					class="dt-card"
					class:dt-rownav={rowNavEnabled || rowClickable}
					class:dt-clickable={rowClickable}
					role={onRowClick ? 'button' : undefined}
					tabindex={onRowClick ? 0 : undefined}
					onclick={onRowClick ? () => onRowClick(row, ctx) : undefined}
					onkeydown={onRowClick
						? (e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onRowClick(row, ctx);
								}
							}
						: undefined}
				>
					{#if rowNavEnabled && rhref}
						<a
							class="dt-rowlink"
							href={rhref}
							target={rowTarget(rhref)}
							rel={rowTarget(rhref) === '_blank' ? 'noopener noreferrer' : undefined}
							aria-label="Open row"
							tabindex="-1"
						></a>
					{/if}
					{#if selectable}
						<div class="dt-card-row">
							<span class="dt-card-label">Select</span>
							<span class="dt-card-val dt-interactive">
								<input
									type="checkbox"
									aria-label="Select row"
									checked={!!selectedKeys?.has(rk)}
									onclick={(e) => e.stopPropagation()}
									onchange={() => toggleRowSel(rk)}
								/>
							</span>
						</div>
					{/if}
					{#each cols as c (c.key)}
						<div class="dt-card-row">
							<span class="dt-card-label">{c.label}</span>
							<span class="dt-card-val">{@render cellContent(c, row)}</span>
						</div>
					{/each}
					{#if hasActionsCol}
						<div class="dt-card-footer">
							<span class="dt-act-wrap" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
								{#if actionCell}{@render actionCell(row, ctx)}{:else}{@render actionButtons(row, ctx)}{/if}
							</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if allRows.length === 0}
		<div class="dt-empty">No rows.</div>
	{:else if sortedRows.length === 0}
		<div class="dt-empty">No matching rows.</div>
	{/if}

	{#if pageSize > 0 && pageCount > 1}
		<div class="dt-pager">
			<button type="button" class="dt-pgbtn" disabled={currentPage <= 0} onclick={() => (page = Math.max(0, currentPage - 1))}>Prev</button>
			<span class="dt-pginfo">Page {currentPage + 1} / {pageCount}</span>
			<button type="button" class="dt-pgbtn" disabled={currentPage >= pageCount - 1} onclick={() => (page = Math.min(pageCount - 1, currentPage + 1))}>Next</button>
		</div>
	{/if}
</div>

<style>
	.dt-root {
		width: 100%;
		height: 100%;
		overflow: auto;
		color: #e2e8f0;
		container-type: inline-size;
		padding-bottom: 1.5rem; /* let the last row scroll clear of any fixed footer */
	}
	.dt-scroll {
		overflow-x: auto;
	}
	/* Default: show the real table. Card layout only kicks in for a genuinely
	   narrow CONTAINER (not viewport) — correct for an embeddable component. */
	.dt-root.cards .dt-scroll {
		display: none;
	}
	@container (min-width: 600px) {
		.dt-root.cards .dt-scroll {
			display: block;
		}
		.dt-root.cards .dt-cards {
			display: none;
		}
	}
	.dt-th {
		position: sticky;
		top: 0;
		z-index: 1;
		font-size: 0.66rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #93a4c4;
		background: #0f172a;
		border-bottom: 1px solid rgba(0, 165, 207, 0.28);
		white-space: nowrap;
		user-select: none;
	}
	.dt-th:hover {
		color: #e2e8f0;
	}
	.dt-td {
		border-bottom: 1px solid rgba(0, 165, 207, 0.12);
		vertical-align: middle;
	}
	.dt-row:hover {
		background: rgba(0, 165, 207, 0.06);
	}
	.dt-striped {
		background: rgba(255, 255, 255, 0.02);
	}
	/* Stretched-anchor row navigation: the row is the positioning context, the
	   anchor stretches over it, and interactive cell content sits above it. */
	.dt-rownav {
		position: relative;
	}
	.dt-clickable {
		cursor: pointer;
	}
	.dt-rowlink {
		position: absolute;
		inset: 0;
		z-index: 0;
	}
	.dt-rowlink::after {
		position: absolute;
		inset: 0;
		content: '';
	}
	/* Keep interactive content clickable above the stretched row anchor. */
	.dt-rownav .dt-interactive,
	.dt-rownav .dt-link,
	.dt-rownav .dt-act-wrap,
	.dt-rownav .dt-selcol,
	.dt-rownav .dt-actcol {
		position: relative;
		z-index: 1;
	}
	.dt-trunc {
		display: inline-block;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		vertical-align: middle;
	}
	.dt-extglyph {
		display: inline-block;
		opacity: 0.7;
		vertical-align: middle;
	}
	.dt-toolbar {
		display: flex;
		justify-content: flex-end;
		padding: 0.35rem 0.25rem;
	}
	.dt-search {
		font: inherit;
		font-size: 0.78rem;
		color: #e2e8f0;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(0, 165, 207, 0.28);
		padding: 0.3rem 0.55rem;
		min-width: 12rem;
	}
	.dt-search::placeholder {
		color: #64748b;
	}
	.dt-selcol,
	.dt-actcol {
		white-space: nowrap;
	}
	.dt-act-wrap {
		display: inline-flex;
		gap: 0.3rem;
		align-items: center;
	}
	.dt-act {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.7rem;
		line-height: 1;
		padding: 0.25rem 0.45rem;
		border: 1px solid rgba(0, 165, 207, 0.28);
		background: transparent;
		color: #cbd5e1;
		cursor: pointer;
	}
	.dt-act:hover:not(:disabled) {
		background: rgba(0, 165, 207, 0.1);
	}
	.dt-act:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.dt-act-primary {
		color: var(--accent-primary, #00a5cf);
		border-color: var(--accent-primary, #00a5cf)55;
	}
	.dt-act-danger {
		color: #f87171;
		border-color: #f8717155;
	}
	.dt-act-ghost {
		border-color: transparent;
	}
	.dt-act-label {
		display: none;
	}
	.dt-cards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.25rem;
	}
	.dt-card {
		border: 1px solid rgba(0, 165, 207, 0.22);
		background: rgba(15, 23, 42, 0.6);
		padding: 0.5rem 0.7rem;
	}
	.dt-card-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.2rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}
	.dt-card-row:last-child {
		border-bottom: none;
	}
	.dt-card-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.3rem;
		padding-top: 0.4rem;
	}
	.dt-card-label {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #6b7da3;
		flex: none;
	}
	.dt-card-val {
		font-size: 0.82rem;
		text-align: right;
		min-width: 0;
	}
	.dt-pager {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.6rem;
		padding: 0.4rem 0.25rem;
	}
	.dt-pgbtn {
		font: inherit;
		font-size: 0.72rem;
		color: #cbd5e1;
		background: transparent;
		border: 1px solid rgba(0, 165, 207, 0.28);
		padding: 0.2rem 0.55rem;
		cursor: pointer;
	}
	.dt-pgbtn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.dt-pginfo {
		font-size: 0.72rem;
		color: #93a4c4;
	}
	.dt-empty {
		padding: 2rem;
		text-align: center;
		font-size: 0.82rem;
		color: #64748b;
	}
</style>

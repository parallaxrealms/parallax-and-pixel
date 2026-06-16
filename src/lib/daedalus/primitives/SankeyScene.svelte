<script lang="ts">
	/**
	 * SankeyScene — native-SVG layered Sankey flow diagram over VizData nodes+edges.
	 * No charting / layout dep: hand-rolled column assignment (longest-path depth
	 * from sources, cycle-safe), node bars sized by max(inflow, outflow), and link
	 * ribbons drawn as filled bezier bands with width ∝ edge.value. Inline
	 * presentation attributes keep PNG export faithful, like the sibling primitives.
	 */
	import type { VizNode, VizEdge } from '../schema';
	import { categoryColor, svgToPng, CONTENT_FONT } from '../chart-utils';

	interface Props {
		nodes: VizNode[];
		edges: VizEdge[];
		selectedId: string | null;
		onSelect: (id: string | null) => void;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let { nodes, edges, selectedId, onSelect, contentFont = 'sans' }: Props = $props();

	const VBW = 860;
	const VBH = 480;
	const L = 16;
	const R = 16;
	const T = 24;
	const B = 24;
	const plotW = VBW - L - R;
	const plotH = VBH - T - B;
	const NODE_W = 16; // node bar thickness
	const NODE_GAP = 14; // vertical gap between stacked nodes in a column

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);

	type LayoutNode = {
		node: VizNode;
		id: string;
		label: string;
		color: string;
		col: number;
		x: number; // left edge of the bar
		y: number; // top edge
		h: number; // bar height
		flow: number; // max(inflow, outflow)
		// running cursor for stacking link attachment points
		inCursor: number;
		outCursor: number;
	};
	type Ribbon = {
		key: string;
		source: string;
		target: string;
		path: string;
		color: string;
		value: number;
	};

	const layout = $derived.by(() => {
		if (!nodes || nodes.length === 0) return null;

		const byId = new Map<string, VizNode>();
		for (const n of nodes) byId.set(n.id, n);

		// Only edges whose endpoints both exist.
		const valid = (edges ?? []).filter((e) => byId.has(e.source) && byId.has(e.target));
		const edgeVal = (e: VizEdge) => (typeof e.value === 'number' && e.value > 0 ? e.value : 1);

		// --- inflow / outflow per node ---
		const inflow = new Map<string, number>();
		const outflow = new Map<string, number>();
		const incomingCount = new Map<string, number>();
		for (const n of nodes) {
			inflow.set(n.id, 0);
			outflow.set(n.id, 0);
			incomingCount.set(n.id, 0);
		}
		for (const e of valid) {
			const v = edgeVal(e);
			outflow.set(e.source, (outflow.get(e.source) ?? 0) + v);
			inflow.set(e.target, (inflow.get(e.target) ?? 0) + v);
			incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1);
		}

		// --- column = longest-path depth from a source (cycle-safe) ---
		// Sources = nodes with no incoming edge; if none (pure cycle), seed all at 0.
		const adj = new Map<string, string[]>();
		for (const n of nodes) adj.set(n.id, []);
		for (const e of valid) adj.get(e.source)!.push(e.target);

		const depth = new Map<string, number>();
		for (const n of nodes) depth.set(n.id, 0);

		const sources = nodes.filter((n) => (incomingCount.get(n.id) ?? 0) === 0).map((n) => n.id);
		const seeds = sources.length > 0 ? sources : nodes.map((n) => n.id);

		// Relax depths up to nodes.length passes; a node already placed keeps its
		// MAX depth. The visited guard on the current walk prevents cycle re-entry.
		const maxPasses = Math.min(nodes.length + 1, 64);
		for (let pass = 0; pass < maxPasses; pass++) {
			let changed = false;
			// BFS-ish relaxation from every seed each pass.
			const stack: { id: string; d: number; seen: Set<string> }[] = seeds.map((id) => ({
				id,
				d: 0,
				seen: new Set<string>()
			}));
			while (stack.length) {
				const cur = stack.pop()!;
				if (cur.seen.has(cur.id)) continue; // cycle guard on this walk
				const seen = new Set(cur.seen);
				seen.add(cur.id);
				if (cur.d > (depth.get(cur.id) ?? 0)) {
					depth.set(cur.id, cur.d);
					changed = true;
				}
				for (const t of adj.get(cur.id) ?? []) {
					if (!seen.has(t)) stack.push({ id: t, d: cur.d + 1, seen });
				}
			}
			if (!changed) break;
		}

		// Group nodes by column (preserve authored order within a column).
		const maxCol = Math.max(0, ...nodes.map((n) => depth.get(n.id) ?? 0));
		const columns: VizNode[][] = Array.from({ length: maxCol + 1 }, () => []);
		for (const n of nodes) columns[depth.get(n.id) ?? 0].push(n);

		// --- height scaling: node height ∝ flow = max(inflow, outflow) ---
		// Find the column whose (sum of flows + gaps) is densest, scale so it fits.
		let unitPerPx = 1; // flow units per pixel of bar height
		let densest = 1;
		for (const col of columns) {
			if (col.length === 0) continue;
			const sumFlow = col.reduce((s, n) => s + Math.max(1, Math.max(inflow.get(n.id) ?? 0, outflow.get(n.id) ?? 0)), 0);
			const avail = plotH - NODE_GAP * (col.length - 1);
			if (avail <= 0) continue;
			const need = sumFlow / Math.max(1, avail);
			if (need > densest) densest = need;
		}
		unitPerPx = densest; // pixels = flowUnits / unitPerPx

		const colCount = columns.length;
		// x position per column: bars spread across plot, centered within slots.
		const colX = (c: number) =>
			colCount === 1 ? L + plotW / 2 - NODE_W / 2 : L + (plotW - NODE_W) * (c / (colCount - 1));

		const placed: LayoutNode[] = [];
		const map = new Map<string, LayoutNode>();
		columns.forEach((col, c) => {
			const totalH =
				col.reduce(
					(s, n) => s + Math.max(6, Math.max(1, Math.max(inflow.get(n.id) ?? 0, outflow.get(n.id) ?? 0)) / unitPerPx),
					0
				) +
				NODE_GAP * (col.length - 1);
			let cursor = T + (plotH - totalH) / 2; // vertical-center the column
			col.forEach((n, i) => {
				const flow = Math.max(1, Math.max(inflow.get(n.id) ?? 0, outflow.get(n.id) ?? 0));
				const h = Math.max(6, flow / unitPerPx);
				const ln: LayoutNode = {
					node: n,
					id: n.id,
					label: n.label,
					color: n.color ?? categoryColor({ color: n.color }, placed.length),
					col: c,
					x: colX(c),
					y: cursor,
					h,
					flow,
					inCursor: 0,
					outCursor: 0
				};
				placed.push(ln);
				map.set(n.id, ln);
				cursor += h + NODE_GAP;
				void i;
			});
		});

		// --- ribbons: order each node's links by the OTHER end's vertical center
		// to reduce crossings (best-effort), then stack proportional bands. ---
		const center = (ln: LayoutNode) => ln.y + ln.h / 2;

		// out-links per source, sorted by target center
		const outBy = new Map<string, VizEdge[]>();
		const inBy = new Map<string, VizEdge[]>();
		for (const e of valid) {
			(outBy.get(e.source) ?? outBy.set(e.source, []).get(e.source)!).push(e);
			(inBy.get(e.target) ?? inBy.set(e.target, []).get(e.target)!).push(e);
		}
		for (const [, arr] of outBy)
			arr.sort((a, b) => (center(map.get(a.target)!) ?? 0) - (center(map.get(b.target)!) ?? 0));
		for (const [, arr] of inBy)
			arr.sort((a, b) => (center(map.get(a.source)!) ?? 0) - (center(map.get(b.source)!) ?? 0));

		const ribbons: Ribbon[] = [];
		// stable iteration over source nodes by placement order
		for (const ln of placed) {
			const outs = outBy.get(ln.id);
			if (!outs) continue;
			for (let k = 0; k < outs.length; k++) {
				const e = outs[k];
				const tgt = map.get(e.target)!;
				const v = edgeVal(e);
				const w = Math.max(1, v / unitPerPx);

				// source attachment band (right edge of source bar)
				const sy0 = ln.y + ln.outCursor;
				const sy1 = sy0 + w;
				ln.outCursor += w;

				// target attachment band (left edge of target bar)
				const ty0 = tgt.y + tgt.inCursor;
				const ty1 = ty0 + w;
				tgt.inCursor += w;

				const sx = ln.x + NODE_W;
				const tx = tgt.x;
				const cx = sx + (tx - sx) / 2;

				// filled band: top edge S→T forward, bottom edge T→S back
				const path =
					`M ${sx.toFixed(1)} ${sy0.toFixed(1)} ` +
					`C ${cx.toFixed(1)} ${sy0.toFixed(1)} ${cx.toFixed(1)} ${ty0.toFixed(1)} ${tx.toFixed(1)} ${ty0.toFixed(1)} ` +
					`L ${tx.toFixed(1)} ${ty1.toFixed(1)} ` +
					`C ${cx.toFixed(1)} ${ty1.toFixed(1)} ${cx.toFixed(1)} ${sy1.toFixed(1)} ${sx.toFixed(1)} ${sy1.toFixed(1)} Z`;

				ribbons.push({
					key: `${e.source}->${e.target}#${k}`,
					source: e.source,
					target: e.target,
					path,
					color: ln.color,
					value: v
				});
			}
		}

		return { placed, ribbons, colCount };
	});

	let svgEl: SVGSVGElement | null = $state(null);
	export function capturePng(): Promise<string | null> {
		return svgEl ? svgToPng(svgEl, VBW, VBH, '#050a14') : Promise.resolve(null);
	}

	function clip(s: string, n: number): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}
</script>

<div class="chart-root">
	<svg
		bind:this={svgEl}
		viewBox="0 0 {VBW} {VBH}"
		preserveAspectRatio="xMidYMid meet"
		style="font-family: {font};"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<rect
			x="0"
			y="0"
			width={VBW}
			height={VBH}
			fill="transparent"
			onclick={() => onSelect(null)}
			role="presentation"
		/>

		{#if layout}
			<!-- link ribbons under the node bars -->
			{#each layout.ribbons as r (r.key)}
				{@const touches = selectedId === r.source || selectedId === r.target}
				{@const dim = selectedId && !touches}
				<path
					d={r.path}
					fill={r.color}
					fill-opacity={dim ? 0.08 : touches ? 0.55 : 0.32}
					stroke={touches ? r.color : 'none'}
					stroke-opacity={touches ? 0.5 : 0}
					stroke-width={touches ? 0.75 : 0}
				/>
			{/each}

			<!-- node bars + labels -->
			{#each layout.placed as n (n.id)}
				{@const isSel = n.id === selectedId}
				{@const dim = selectedId && !isSel}
				{@const isFirst = n.col === 0}
				{@const isLast = n.col === layout.colCount - 1}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<g
					data-node-id={n.id}
					class="node"
					onclick={(e) => {
						e.stopPropagation();
						onSelect(n.id);
					}}
					role="button"
					tabindex="-1"
				>
					<rect
						x={n.x}
						y={n.y}
						width={NODE_W}
						height={n.h}
						fill={n.color}
						fill-opacity={dim ? 0.4 : 0.95}
						stroke={isSel ? '#f5a623' : 'rgba(0,0,0,0.4)'}
						stroke-width={isSel ? 2 : 0.75}
					/>
					{#if isFirst}
						<text
							x={n.x + NODE_W + 8}
							y={n.y + n.h / 2}
							text-anchor="start"
							dominant-baseline="middle"
							font-size="12"
							font-weight={isSel ? 700 : 500}
							fill={dim ? 'rgba(255,255,255,0.45)' : '#e6ecfb'}
						>
							{clip(n.label, 22)}
						</text>
					{:else if isLast}
						<text
							x={n.x - 8}
							y={n.y + n.h / 2}
							text-anchor="end"
							dominant-baseline="middle"
							font-size="12"
							font-weight={isSel ? 700 : 500}
							fill={dim ? 'rgba(255,255,255,0.45)' : '#e6ecfb'}
						>
							{clip(n.label, 22)}
						</text>
					{:else}
						<text
							x={n.x + NODE_W / 2}
							y={n.y - 5}
							text-anchor="middle"
							dominant-baseline="auto"
							font-size="11"
							font-weight={isSel ? 700 : 500}
							fill={dim ? 'rgba(255,255,255,0.45)' : '#e6ecfb'}
						>
							{clip(n.label, 20)}
						</text>
					{/if}
				</g>
			{/each}
		{:else}
			<text
				x={VBW / 2}
				y={VBH / 2}
				text-anchor="middle"
				font-size="15"
				fill="rgba(255,255,255,0.4)"
			>
				No data — add nodes and edges
			</text>
		{/if}
	</svg>
</div>

<style>
	.chart-root {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding: 1.25rem;
	}
	svg {
		width: 100%;
		height: 100%;
		max-height: 100%;
	}
	.node {
		cursor: pointer;
	}
	.node rect {
		transition:
			fill-opacity 0.15s ease,
			stroke 0.15s ease;
	}
</style>

<script lang="ts">
	/**
	 * TreemapScene — native-SVG squarified treemap over VizData nodes+edges.
	 *
	 * Hierarchy is built from edges (edge.source = parent, edge.target = child):
	 * the root is the node with no incoming edge; if there are several, a virtual
	 * root nests them. Leaf size = node.value (default 1); branch size = sum of
	 * children. Layout is the standard, deterministic squarify algorithm — no
	 * randomness. The full tree is laid out recursively: each parent rect gets a
	 * small inset + a header strip carrying its label, and its children are
	 * squarified inside the remaining area. Parent rects tint lighter than their
	 * children. Inline presentation attributes keep PNG export faithful, like the
	 * sibling primitives.
	 */
	import type { VizNode, VizEdge } from '../schema';
	import { categoryColor, formatNumber, svgToPng, CONTENT_FONT } from '../chart-utils';

	interface Props {
		nodes: VizNode[];
		edges: VizEdge[];
		selectedId: string | null;
		onSelect: (id: string | null) => void;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let { nodes, edges, selectedId, onSelect, contentFont = 'sans' }: Props = $props();

	const VBW = 860;
	const VBH = 520;
	const PAD = 6; // inset between a parent rect and its children area
	const HEADER = 18; // header strip height reserved for a branch label

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);

	const VIRTUAL_ROOT = '__treemap_virtual_root__';

	type HNode = {
		id: string;
		node: VizNode | null; // null for the synthesized virtual root
		label: string;
		value: number;
		depth: number;
		children: HNode[];
	};

	type Rect = { x: number; y: number; w: number; h: number };

	type Cell = {
		id: string;
		node: VizNode | null;
		label: string;
		value: number;
		depth: number;
		isBranch: boolean;
		x: number;
		y: number;
		w: number;
		h: number;
		color: string;
	};

	/** Lighten a #rrggbb hex toward white by t in [0,1] (deterministic). */
	function lighten(hex: string, t: number): string {
		const h = hex.replace('#', '');
		if (h.length !== 6) return hex;
		const r = parseInt(h.slice(0, 2), 16);
		const g = parseInt(h.slice(2, 4), 16);
		const b = parseInt(h.slice(4, 6), 16);
		const mix = (c: number) => Math.round(c + (255 - c) * t);
		const to2 = (c: number) => mix(c).toString(16).padStart(2, '0');
		return `#${to2(r)}${to2(g)}${to2(b)}`;
	}

	// --- 1. build the hierarchy from edges, cycle-safe ----------------------
	const tree = $derived.by<HNode | null>(() => {
		if (!nodes || nodes.length === 0) return null;

		const byId = new Map<string, VizNode>();
		for (const n of nodes) byId.set(n.id, n);

		// only edges whose endpoints both exist
		const valid = (edges ?? []).filter((e) => byId.has(e.source) && byId.has(e.target));

		// child -> parent (first wins; ignore duplicate/extra parents to keep a tree)
		const parentOf = new Map<string, string>();
		const childrenOf = new Map<string, string[]>();
		for (const n of nodes) childrenOf.set(n.id, []);
		for (const e of valid) {
			if (e.source === e.target) continue; // self-loop guard
			if (!parentOf.has(e.target)) {
				parentOf.set(e.target, e.source);
				childrenOf.get(e.source)!.push(e.target);
			}
		}

		// roots = nodes with no incoming (parent) edge
		const roots = nodes.filter((n) => !parentOf.has(n.id)).map((n) => n.id);

		// build, guarding against cycles via a visited set on the descent
		const buildNode = (id: string, depth: number, seen: Set<string>): HNode => {
			const node = byId.get(id) ?? null;
			const kids = (childrenOf.get(id) ?? []).filter((c) => !seen.has(c));
			const childNodes: HNode[] = [];
			for (const c of kids) {
				const next = new Set(seen);
				next.add(c);
				childNodes.push(buildNode(c, depth + 1, next));
			}
			// leaf value = node.value (default 1); branch value = sum of children
			const ownValue = typeof node?.value === 'number' && node.value > 0 ? node.value : 1;
			const value =
				childNodes.length > 0 ? childNodes.reduce((s, k) => s + k.value, 0) : ownValue;
			return {
				id,
				node,
				label: node?.label ?? id,
				value: Math.max(value, 0.0001),
				depth,
				children: childNodes
			};
		};

		let rootNodes: HNode[];
		if (roots.length === 0) {
			// pure cycle / no clear root — treat every node as a top-level entry
			const seen = new Set<string>();
			rootNodes = nodes
				.filter((n) => !seen.has(n.id))
				.map((n) => {
					seen.add(n.id);
					return buildNode(n.id, 1, new Set([n.id]));
				});
		} else {
			rootNodes = roots.map((id) => buildNode(id, 1, new Set([id])));
		}

		if (rootNodes.length === 1) {
			// single real root: depths already start at 1 — drop to 0 for top-level
			return liftDepth(rootNodes[0]);
		}
		// several roots: synthesize a virtual root that nests them
		return {
			id: VIRTUAL_ROOT,
			node: null,
			label: 'Treemap',
			value: rootNodes.reduce((s, k) => s + k.value, 0) || 1,
			depth: 0,
			children: rootNodes
		};
	});

	/** Re-base a single-root subtree so the root is depth 0. */
	function liftDepth(root: HNode): HNode {
		const walk = (n: HNode, d: number): HNode => ({
			...n,
			depth: d,
			children: n.children.map((c) => walk(c, d + 1))
		});
		return walk(root, 0);
	}

	// --- 2. squarify --------------------------------------------------------
	// Standard squarify: greedily add children to a "row" laid along the shorter
	// side of the remaining rect, keeping aspect ratios as close to 1 as possible.

	/** Lay out `items` (already value-sorted desc) inside `rect`; returns positioned rects. */
	function squarify(items: HNode[], rect: Rect): { node: HNode; rect: Rect }[] {
		const out: { node: HNode; rect: Rect }[] = [];
		const total = items.reduce((s, n) => s + n.value, 0);
		if (total <= 0 || rect.w <= 0 || rect.h <= 0) return out;

		// scale node values to pixel-area within this rect
		const area = rect.w * rect.h;
		const scale = area / total;
		const scaled = items.map((n) => ({ node: n, a: n.value * scale }));

		let { x, y, w, h } = rect;
		let i = 0;
		while (i < scaled.length) {
			const side = Math.min(w, h);
			const row: { node: HNode; a: number }[] = [];
			let rowSum = 0;
			// grow the row while it keeps the worst aspect ratio from increasing
			let j = i;
			while (j < scaled.length) {
				const cand = rowSum + scaled[j].a;
				const curWorst =
					row.length === 0
						? Infinity
						: worstArea(row.map((r) => r.a), side, rowSum);
				const nextWorst = worstArea([...row.map((r) => r.a), scaled[j].a], side, cand);
				if (row.length === 0 || nextWorst <= curWorst) {
					row.push(scaled[j]);
					rowSum = cand;
					j++;
				} else {
					break;
				}
			}

			// place the row along `side`; the row occupies a band of thickness rowSum/side
			const bandT = rowSum / side;
			if (w >= h) {
				// vertical band on the left, children stacked top→bottom
				let cy = y;
				for (const r of row) {
					const ch = side > 0 ? r.a / bandT : 0;
					out.push({ node: r.node, rect: { x, y: cy, w: bandT, h: ch } });
					cy += ch;
				}
				x += bandT;
				w -= bandT;
			} else {
				// horizontal band on top, children laid left→right
				let cx = x;
				for (const r of row) {
					const cw = side > 0 ? r.a / bandT : 0;
					out.push({ node: r.node, rect: { x: cx, y, w: cw, h: bandT } });
					cx += cw;
				}
				y += bandT;
				h -= bandT;
			}
			i = j;
		}
		return out;
	}

	/** worst() variant taking raw scaled areas (pixel units). */
	function worstArea(areas: number[], side: number, sum: number): number {
		if (sum <= 0 || side <= 0 || areas.length === 0) return Infinity;
		const max = Math.max(...areas);
		const min = Math.min(...areas);
		const s2 = sum * sum;
		const side2 = side * side;
		return Math.max((side2 * max) / s2, s2 / (side2 * min));
	}

	// --- 3. recursively place every node into flat cells -------------------
	const cells = $derived.by<Cell[]>(() => {
		const root = tree;
		if (!root) return [];
		const acc: Cell[] = [];
		let paletteCursor = 0;

		const resolveColor = (n: HNode, inherited: string | null): string => {
			if (n.node?.color) return n.node.color;
			if (inherited) return inherited;
			return categoryColor({ color: undefined }, paletteCursor++);
		};

		const place = (
			n: HNode,
			rect: Rect,
			baseColor: string | null,
			emitSelf: boolean
		) => {
			const isBranch = n.children.length > 0;
			const color = resolveColor(n, baseColor);

			if (emitSelf) {
				acc.push({
					id: n.id,
					node: n.node,
					label: n.label,
					value: n.value,
					depth: n.depth,
					isBranch,
					x: rect.x,
					y: rect.y,
					w: rect.w,
					h: rect.h,
					color
				});
			}

			if (!isBranch) return;

			// inner area for children: inset + header strip when the parent rect is
			// drawn (emitSelf) and tall enough to show a header.
			const showHeader = emitSelf && rect.h > HEADER + PAD * 2 + 8;
			const inset = emitSelf ? PAD : 0;
			const top = inset + (showHeader ? HEADER : 0);
			const inner: Rect = {
				x: rect.x + inset,
				y: rect.y + top,
				w: rect.w - inset * 2,
				h: rect.h - top - inset
			};
			if (inner.w <= 1 || inner.h <= 1) return;

			// children sorted by value desc (deterministic; tie-break by id)
			const kids = [...n.children].sort((a, b) => b.value - a.value || (a.id < b.id ? -1 : 1));
			// children inherit a lighter shade so leaves read against the parent tint
			const placed = squarify(kids, inner);
			for (const p of placed) {
				place(p.node, p.rect, color, true);
			}
		};

		// the root fills the canvas; its own rect is only emitted when it's a real
		// node (single root) — the virtual root is structural and never drawn.
		const canvas: Rect = { x: 0, y: 0, w: VBW, h: VBH };
		const rootIsVirtual = root.id === VIRTUAL_ROOT;
		place(root, canvas, null, !rootIsVirtual);
		return acc;
	});

	let svgEl: SVGSVGElement | null = $state(null);
	export function capturePng(): Promise<string | null> {
		return svgEl ? svgToPng(svgEl, VBW, VBH, '#050a14') : Promise.resolve(null);
	}

	function clip(s: string, n: number): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	/** Branch rects tint lighter than leaves; deeper branches a touch lighter still. */
	function fillFor(c: Cell): string {
		if (c.isBranch) return lighten(c.color, 0.32 + Math.min(c.depth, 3) * 0.04);
		return c.color;
	}

	/** Black or white text depending on rough luminance of the fill. */
	function textOn(hex: string): string {
		const h = hex.replace('#', '');
		if (h.length !== 6) return '#fff';
		const r = parseInt(h.slice(0, 2), 16);
		const g = parseInt(h.slice(2, 4), 16);
		const b = parseInt(h.slice(4, 6), 16);
		const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return lum > 0.6 ? '#0b1020' : '#ffffff';
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

		{#if cells.length > 0}
			{#each cells as c (c.id)}
				{@const isSel = c.id === selectedId}
				{@const dim = selectedId && !isSel}
				{@const fill = fillFor(c)}
				{@const showHeader = c.isBranch && c.h > HEADER + PAD * 2 + 8}
				{@const fitsLeafLabel = !c.isBranch && c.w > 46 && c.h > 22}
				{@const txt = textOn(fill)}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<g
					data-node-id={c.id}
					class="cell"
					onclick={(e) => {
						e.stopPropagation();
						onSelect(c.id);
					}}
					role="button"
					tabindex="-1"
				>
					<rect
						x={c.x}
						y={c.y}
						width={c.w}
						height={c.h}
						fill={fill}
						fill-opacity={dim ? (c.isBranch ? 0.22 : 0.4) : c.isBranch ? 0.55 : 0.95}
						stroke={isSel ? '#f5a623' : 'rgba(0,0,0,0.45)'}
						stroke-width={isSel ? 2.5 : 0.75}
					/>

					{#if showHeader}
						<!-- branch header strip label -->
						<text
							x={c.x + PAD + 2}
							y={c.y + HEADER / 2 + PAD / 2}
							text-anchor="start"
							dominant-baseline="middle"
							font-size="11"
							font-weight={isSel ? 700 : 600}
							fill={dim ? 'rgba(255,255,255,0.5)' : txt}
						>
							{clip(c.label, Math.max(2, Math.floor((c.w - PAD * 2) / 6.5)))}
						</text>
					{:else if fitsLeafLabel}
						<!-- leaf label centered when it fits -->
						<text
							x={c.x + c.w / 2}
							y={c.h > 34 ? c.y + c.h / 2 - 5 : c.y + c.h / 2}
							text-anchor="middle"
							dominant-baseline="middle"
							font-size="11"
							font-weight={isSel ? 700 : 500}
							fill={dim ? 'rgba(255,255,255,0.55)' : txt}
						>
							{clip(c.label, Math.max(2, Math.floor(c.w / 6.5)))}
						</text>
						{#if c.h > 34}
							<text
								x={c.x + c.w / 2}
								y={c.y + c.h / 2 + 10}
								text-anchor="middle"
								dominant-baseline="middle"
								font-size="10"
								fill={dim ? 'rgba(255,255,255,0.4)' : txt}
								fill-opacity="0.8"
							>
								{formatNumber(c.value)}
							</text>
						{/if}
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
				No data — add nodes and parent→child edges
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
	.cell {
		cursor: pointer;
	}
	.cell rect {
		transition:
			fill-opacity 0.15s ease,
			stroke 0.15s ease;
	}
</style>

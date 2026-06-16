<script lang="ts">
	/**
	 * HeatmapScene — native-SVG grid of tiles over VizData.matrix.
	 * Row-major values[y][x]; null = no tile. Tile fill comes from matrix.thresholds
	 * (via scalarColor) when present, else a sequential ramp derived from the
	 * daedalus accent within the data's min..max. No charting dep; inline
	 * presentation attributes keep the PNG export faithful.
	 */
	import type { VizMatrix } from '../schema';
	import { scalarColor, formatNumber, svgToPng, CONTENT_FONT, CHART_PALETTE } from '../chart-utils';

	interface Props {
		matrix: VizMatrix;
		selectedCell?: { x: number; y: number } | null;
		onSelectCell?: (c: { x: number; y: number } | null) => void;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let { matrix, selectedCell = null, onSelectCell, contentFont = 'sans' }: Props = $props();

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);

	// --- geometry -----------------------------------------------------------
	const TILE = 46; // base tile edge (px in viewBox units)
	const GAP = 3;
	const LABEL_L = 110; // y-label gutter
	const LABEL_T = 30; // x-label band (top)
	const PAD = 14;
	const LEGEND_H = 34;

	const cols = $derived(matrix.xLabels?.length ?? 0);
	const rows = $derived(matrix.yLabels?.length ?? 0);
	const unit = $derived(matrix.unit ?? '');

	const gridW = $derived(cols * TILE + Math.max(0, cols - 1) * GAP);
	const gridH = $derived(rows * TILE + Math.max(0, rows - 1) * GAP);

	const VBW = $derived(LABEL_L + gridW + PAD * 2);
	const VBH = $derived(LABEL_T + gridH + PAD * 2 + LEGEND_H);

	// --- data range ---------------------------------------------------------
	const stats = $derived.by(() => {
		let lo = Infinity;
		let hi = -Infinity;
		for (const row of matrix.values ?? []) {
			for (const v of row ?? []) {
				if (v == null || !Number.isFinite(v)) continue;
				if (v < lo) lo = v;
				if (v > hi) hi = v;
			}
		}
		if (!Number.isFinite(lo)) {
			lo = 0;
			hi = 0;
		}
		return { lo, hi };
	});

	const hasThresholds = $derived(!!matrix.thresholds && matrix.thresholds.length > 0);

	// Sequential ramp: blend daedalus accent toward white across the data range.
	const RAMP_BASE = CHART_PALETTE[0]; // cobalt accent
	function hexToRgb(hex: string): [number, number, number] {
		const h = hex.replace('#', '');
		const n = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h;
		return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
	}
	const RAMP_RGB = hexToRgb(RAMP_BASE);

	/** 0..1 fraction → cobalt (low/dark) up to a bright tint (high). */
	function rampColor(frac: number): string {
		const f = Math.min(1, Math.max(0, frac));
		// dark floor (0.32×) at low end, full bright tint toward white at high end
		const lo = 0.34;
		const k = lo + (1 - lo) * f;
		const r = Math.round(RAMP_RGB[0] * k + 255 * f * 0.18);
		const g = Math.round(RAMP_RGB[1] * k + 255 * f * 0.18);
		const b = Math.round(RAMP_RGB[2] * k + 255 * f * 0.18);
		return `rgb(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)})`;
	}

	function tileFill(v: number): string {
		if (hasThresholds) {
			return scalarColor({ value: v, thresholds: matrix.thresholds }, RAMP_BASE);
		}
		const { lo, hi } = stats;
		const frac = hi === lo ? 1 : (v - lo) / (hi - lo);
		return rampColor(frac);
	}

	/** Pick a readable text color against a given tile fill. */
	function textOn(v: number): string {
		const { lo, hi } = stats;
		if (hasThresholds) return '#0b1020';
		const frac = hi === lo ? 1 : (v - lo) / (hi - lo);
		return frac > 0.55 ? '#0b1020' : 'rgba(255,255,255,0.92)';
	}

	interface Tile {
		x: number;
		y: number;
		px: number;
		py: number;
		v: number;
		fill: string;
		text: string;
		selected: boolean;
	}

	const tiles = $derived.by<Tile[]>(() => {
		const out: Tile[] = [];
		const vals = matrix.values ?? [];
		for (let y = 0; y < rows; y++) {
			const row = vals[y] ?? [];
			for (let x = 0; x < cols; x++) {
				const v = row[x];
				if (v == null || !Number.isFinite(v)) continue;
				out.push({
					x,
					y,
					px: LABEL_L + PAD + x * (TILE + GAP),
					py: LABEL_T + PAD + y * (TILE + GAP),
					v,
					fill: tileFill(v),
					text: textOn(v),
					selected: !!selectedCell && selectedCell.x === x && selectedCell.y === y
				});
			}
		}
		return out;
	});

	// Value text only when the tile is large enough to be legible.
	const showValues = $derived(TILE >= 34);

	function fmt(v: number): string {
		return formatNumber(v) + unit;
	}

	function clickTile(t: Tile) {
		if (!onSelectCell) return;
		if (t.selected) onSelectCell(null);
		else onSelectCell({ x: t.x, y: t.y });
	}

	// --- legend -------------------------------------------------------------
	const legendY = $derived(LABEL_T + PAD + gridH + 18);
	const legendX = $derived(LABEL_L + PAD);
	const legendW = $derived(Math.min(gridW, 240));

	const rampStops = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => ({ off: f * 100, color: rampColor(f) })));
	const sortedThresholds = $derived(
		hasThresholds ? [...matrix.thresholds!].sort((a, b) => a.at - b.at) : []
	);

	let svgEl: SVGSVGElement | null = $state(null);
	export function capturePng(): Promise<string | null> {
		return svgEl ? svgToPng(svgEl, VBW, VBH, '#050a14') : Promise.resolve(null);
	}
</script>

<div class="heatmap-root">
	<div class="heatmap-scroll">
		<svg
			bind:this={svgEl}
			viewBox="0 0 {VBW} {VBH}"
			preserveAspectRatio="xMidYMid meet"
			style="font-family: {font}; width: {VBW}px; height: {VBH}px;"
		>
			<!-- background catch: click empty space to clear selection -->
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<rect
				x="0"
				y="0"
				width={VBW}
				height={VBH}
				fill="transparent"
				onclick={() => onSelectCell?.(null)}
				role="presentation"
			/>

			<!-- x labels (top) -->
			{#each matrix.xLabels ?? [] as xl, x (x)}
				<text
					x={LABEL_L + PAD + x * (TILE + GAP) + TILE / 2}
					y={LABEL_T + PAD - 8}
					text-anchor="middle"
					font-size="11"
					fill="rgba(255,255,255,0.6)"
				>
					{xl.length > 8 ? xl.slice(0, 7) + '…' : xl}
				</text>
			{/each}

			<!-- y labels (side) -->
			{#each matrix.yLabels ?? [] as yl, y (y)}
				<text
					x={LABEL_L + PAD - 10}
					y={LABEL_T + PAD + y * (TILE + GAP) + TILE / 2 + 4}
					text-anchor="end"
					font-size="11"
					fill="rgba(255,255,255,0.6)"
				>
					{yl.length > 16 ? yl.slice(0, 15) + '…' : yl}
				</text>
			{/each}

			<!-- tiles -->
			{#each tiles as t (t.x + ',' + t.y)}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<g
					class="tile"
					class:selected={t.selected}
					data-cell-x={t.x}
					data-cell-y={t.y}
					onclick={(e) => {
						e.stopPropagation();
						clickTile(t);
					}}
					role="button"
					tabindex="-1"
				>
					<rect
						x={t.px}
						y={t.py}
						width={TILE}
						height={TILE}
						fill={t.fill}
						fill-opacity={selectedCell && !t.selected ? 0.5 : 0.95}
						stroke={t.selected ? '#f5a623' : 'rgba(0,0,0,0.25)'}
						stroke-width={t.selected ? 2.5 : 1}
					/>
					{#if showValues}
						<text
							x={t.px + TILE / 2}
							y={t.py + TILE / 2 + 4}
							text-anchor="middle"
							font-size="11"
							font-weight="600"
							fill={t.text}
						>
							{fmt(t.v)}
						</text>
					{/if}
				</g>
			{/each}

			<!-- legend -->
			{#if hasThresholds}
				{#each sortedThresholds as band, i (i)}
					<rect
						x={legendX + i * 78}
						y={legendY}
						width="14"
						height="14"
						fill={band.color}
						stroke="rgba(0,0,0,0.25)"
						stroke-width="1"
					/>
					<text
						x={legendX + i * 78 + 20}
						y={legendY + 11}
						font-size="11"
						fill="rgba(255,255,255,0.65)"
					>
						≥ {formatNumber(band.at)}{unit}
					</text>
				{/each}
			{:else}
				<defs>
					<linearGradient id="heatmap-ramp" x1="0" y1="0" x2="1" y2="0">
						{#each rampStops as s (s.off)}
							<stop offset="{s.off}%" stop-color={s.color} />
						{/each}
					</linearGradient>
				</defs>
				<rect
					x={legendX}
					y={legendY}
					width={legendW}
					height="12"
					fill="url(#heatmap-ramp)"
					stroke="rgba(255,255,255,0.15)"
					stroke-width="1"
				/>
				<text x={legendX} y={legendY + 26} font-size="11" fill="rgba(255,255,255,0.6)">
					{fmt(stats.lo)}
				</text>
				<text
					x={legendX + legendW}
					y={legendY + 26}
					text-anchor="end"
					font-size="11"
					fill="rgba(255,255,255,0.6)"
				>
					{fmt(stats.hi)}
				</text>
			{/if}
		</svg>
	</div>
</div>

<style>
	.heatmap-root {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding: 1rem;
		overflow: hidden;
	}
	/* Fill the container; scroll only when the grid is larger than the viewport. */
	.heatmap-scroll {
		max-width: 100%;
		max-height: 100%;
		overflow: auto;
		display: grid;
		place-items: center;
	}
	svg {
		max-width: 100%;
		max-height: 100%;
	}
	.tile {
		cursor: pointer;
	}
	.tile rect {
		transition:
			fill-opacity 0.15s ease,
			stroke 0.15s ease;
	}
</style>

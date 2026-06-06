<script lang="ts">
	/**
	 * Multi-series time-series line chart. Pure SVG, no chart library.
	 * Sharp edges, dark, compact. Ported from 9realms; structural grays
	 * restyled to the p&p slate palette.
	 *
	 * Series values: { t: epochSec, v: number | null }[]
	 */

	import type { ChartSeries } from './types';

	interface Props {
		series: ChartSeries[];
		height?: number;
		yFormat?: (v: number) => string;
		yMin?: number;
		yMax?: number;
		title?: string;
		unit?: string;
		loading?: boolean;
		error?: string | null;
		hideLegend?: boolean;
	}

	let {
		series,
		height = 180,
		yFormat = (v: number) => v.toFixed(2),
		yMin,
		yMax,
		title,
		unit,
		loading = false,
		error = null,
		hideLegend = false
	}: Props = $props();

	const WIDTH = 800;
	const PAD_TOP = 12;
	const PAD_BOTTOM = 22;
	const PAD_LEFT = 44;
	const PAD_RIGHT = 12;

	let innerWidth = $derived(WIDTH - PAD_LEFT - PAD_RIGHT);
	let innerHeight = $derived(height - PAD_TOP - PAD_BOTTOM);

	let visible = $state<Record<string, boolean>>({});
	$effect(() => {
		for (const s of series) {
			if (visible[s.key] === undefined) visible[s.key] = true;
		}
	});

	let activeSeries = $derived(series.filter((s) => visible[s.key] !== false));

	let xExtent = $derived.by(() => {
		let min = Infinity;
		let max = -Infinity;
		for (const s of activeSeries) {
			for (const p of s.points) {
				if (p.t < min) min = p.t;
				if (p.t > max) max = p.t;
			}
		}
		if (!isFinite(min) || !isFinite(max) || min === max) {
			const now = Math.floor(Date.now() / 1000);
			return { min: now - 3600, max: now };
		}
		return { min, max };
	});

	let yExtent = $derived.by(() => {
		let min = yMin ?? Infinity;
		let max = yMax ?? -Infinity;
		if (yMin === undefined || yMax === undefined) {
			for (const s of activeSeries) {
				for (const p of s.points) {
					if (p.v === null || !isFinite(p.v)) continue;
					if (yMin === undefined && p.v < min) min = p.v;
					if (yMax === undefined && p.v > max) max = p.v;
				}
			}
		}
		if (!isFinite(min)) min = 0;
		if (!isFinite(max)) max = 1;
		if (min === max) {
			max = min + 1;
		}
		// Pad slightly
		if (yMin === undefined) {
			min = Math.min(min, 0);
		}
		if (yMax === undefined) {
			max = max * 1.1;
		}
		return { min, max };
	});

	function xPos(t: number): number {
		const range = xExtent.max - xExtent.min || 1;
		return PAD_LEFT + ((t - xExtent.min) / range) * innerWidth;
	}

	function yPos(v: number): number {
		const range = yExtent.max - yExtent.min || 1;
		return PAD_TOP + innerHeight - ((v - yExtent.min) / range) * innerHeight;
	}

	function pathFor(points: { t: number; v: number | null }[]): string {
		let d = '';
		let pen = false;
		for (const p of points) {
			if (p.v === null || !isFinite(p.v)) {
				pen = false;
				continue;
			}
			const x = xPos(p.t);
			const y = yPos(p.v);
			d += (pen ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
			pen = true;
		}
		return d.trim();
	}

	function fmtTime(epochSec: number): string {
		const d = new Date(epochSec * 1000);
		const rangeSec = xExtent.max - xExtent.min;
		if (rangeSec > 86400 * 2) {
			return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		}
		return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	let hover = $state<{ idx: number; x: number } | null>(null);

	function handleMove(event: MouseEvent) {
		const target = event.currentTarget as SVGSVGElement;
		const rect = target.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
		// Find time at x, then nearest sample across all series
		const range = xExtent.max - xExtent.min || 1;
		const t = xExtent.min + ((x - PAD_LEFT) / innerWidth) * range;
		// Use first active series' points as the index basis
		const ref = activeSeries[0]?.points;
		if (!ref || ref.length === 0) {
			hover = null;
			return;
		}
		let bestIdx = 0;
		let bestDist = Infinity;
		for (let i = 0; i < ref.length; i++) {
			const d = Math.abs(ref[i]!.t - t);
			if (d < bestDist) {
				bestDist = d;
				bestIdx = i;
			}
		}
		hover = { idx: bestIdx, x: xPos(ref[bestIdx]!.t) };
	}

	function clearHover() {
		hover = null;
	}

	// Y grid: 4 lines
	let yGrid = $derived.by(() => {
		const lines: { v: number; y: number }[] = [];
		for (let i = 0; i <= 4; i++) {
			const v = yExtent.min + (yExtent.max - yExtent.min) * (i / 4);
			lines.push({ v, y: yPos(v) });
		}
		return lines;
	});

	let hoverPoint = $derived.by(() => {
		if (hover === null) return null;
		const ref = activeSeries[0]?.points;
		if (!ref) return null;
		const p = ref[hover.idx];
		if (!p) return null;
		return { t: p.t };
	});
</script>

<div class="border border-slate-800 bg-slate-900/40">
	{#if title}
		<div class="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
			<div class="text-xs font-semibold text-slate-300">{title}</div>
			{#if unit}
				<div class="font-mono text-[10px] text-slate-500">{unit}</div>
			{/if}
		</div>
	{/if}

	<div class="relative">
		{#if loading && series.length === 0}
			<div class="flex items-center justify-center px-3 text-xs text-slate-500" style="height:{height}px">
				Loading…
			</div>
		{:else if error}
			<div class="flex items-center justify-center px-3 text-xs text-red-400" style="height:{height}px">
				{error}
			</div>
		{:else if activeSeries.length === 0 || activeSeries.every((s) => s.points.length === 0)}
			<div class="flex items-center justify-center px-3 text-xs text-slate-600" style="height:{height}px">
				No data
			</div>
		{:else}
			<svg
				viewBox="0 0 {WIDTH} {height}"
				preserveAspectRatio="none"
				class="block w-full"
				style="height:{height}px"
				onmousemove={handleMove}
				onmouseleave={clearHover}
				role="img"
				aria-label={title ?? 'time series'}
			>
				<!-- Y grid -->
				{#each yGrid as g}
					<line
						x1={PAD_LEFT}
						x2={WIDTH - PAD_RIGHT}
						y1={g.y}
						y2={g.y}
						stroke="rgba(255,255,255,0.05)"
						stroke-width="1"
					/>
					<text
						x={PAD_LEFT - 4}
						y={g.y + 3}
						text-anchor="end"
						class="fill-slate-600 font-mono"
						style="font-size:9px"
					>
						{yFormat(g.v)}
					</text>
				{/each}

				<!-- Series lines -->
				{#each activeSeries as s}
					<path
						d={pathFor(s.points)}
						fill="none"
						stroke={s.color}
						stroke-width="1.5"
						stroke-dasharray={s.dashed ? '3 3' : undefined}
					/>
				{/each}

				<!-- X axis end labels -->
				<text
					x={PAD_LEFT}
					y={height - 6}
					text-anchor="start"
					class="fill-slate-600"
					style="font-size:10px"
				>
					{fmtTime(xExtent.min)}
				</text>
				<text
					x={WIDTH - PAD_RIGHT}
					y={height - 6}
					text-anchor="end"
					class="fill-slate-600"
					style="font-size:10px"
				>
					{fmtTime(xExtent.max)}
				</text>

				<!-- Hover -->
				{#if hover && hoverPoint}
					<line
						x1={hover.x}
						x2={hover.x}
						y1={PAD_TOP}
						y2={height - PAD_BOTTOM}
						stroke="rgba(255,255,255,0.18)"
						stroke-width="1"
					/>
					{#each activeSeries as s}
						{@const p = s.points[hover.idx]}
						{#if p && p.v !== null && isFinite(p.v)}
							<circle cx={hover.x} cy={yPos(p.v)} r="2.5" fill={s.color} stroke="#000" stroke-width="1" />
						{/if}
					{/each}
					{@const tx = Math.min(Math.max(hover.x + 8, PAD_LEFT + 4), WIDTH - PAD_RIGHT - 160)}
					{@const ty = PAD_TOP + 4}
					{@const lineH = 12}
					{@const boxH = 16 + activeSeries.length * lineH}
					<rect
						x={tx}
						y={ty}
						width="156"
						height={boxH}
						fill="#020617"
						stroke="rgba(255,255,255,0.15)"
						stroke-width="1"
					/>
					<text x={tx + 6} y={ty + 12} class="fill-slate-300 font-mono" style="font-size:10px">
						{fmtTime(hoverPoint.t)}
					</text>
					{#each activeSeries as s, i}
						{@const p = s.points[hover.idx]}
						<text
							x={tx + 6}
							y={ty + 12 + (i + 1) * lineH}
							style="font-size:10px"
							class="font-mono"
							fill={s.color}
						>
							{s.label}: {p && p.v !== null && isFinite(p.v) ? yFormat(p.v) : '·'}
						</text>
					{/each}
				{/if}
			</svg>
		{/if}
	</div>

	{#if !hideLegend && series.length > 1}
		<div class="flex flex-wrap gap-1 border-t border-slate-800 px-2 py-1.5 text-[10px]">
			{#each series as s}
				<button
					type="button"
					class="inline-flex items-center gap-1 border px-1.5 py-0.5 transition {visible[s.key] !== false
						? 'border-slate-700 text-slate-300'
						: 'border-slate-800 text-slate-600'}"
					onclick={() => (visible[s.key] = !(visible[s.key] !== false))}
				>
					<span
						class="inline-block h-1.5 w-3"
						style="background: {visible[s.key] !== false ? s.color : '#334155'}"
					></span>
					{s.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<script lang="ts">
	/**
	 * LineScene — native-SVG renderer for the series family: line, area, scatter.
	 * One component, mode-switched. Supports multi-series, stacking, step/smooth
	 * interpolation, dots, and numeric OR categorical X. No charting dep.
	 */
	import type { VizSeries } from '../schema';
	import { seriesColor, axisTicks, formatNumber, svgToPng, CONTENT_FONT } from '../chart-utils';

	interface Props {
		series: VizSeries[];
		mode: 'line' | 'area' | 'scatter';
		stacked?: boolean;
		showDots?: boolean;
		selectedId: string | null;
		onSelect: (id: string | null) => void;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let {
		series,
		mode,
		stacked = false,
		showDots = false,
		selectedId,
		onSelect,
		contentFont = 'sans'
	}: Props = $props();

	const VBW = 820;
	const VBH = 460;
	const L = 56;
	const R = 24;
	const T = 30;
	const B = 54;
	const plotW = VBW - L - R;
	const plotH = VBH - T - B;
	const baseY = T + plotH;

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);

	type Pt = { x: number; y: number };
	function buildPath(pts: Pt[], interp: 'linear' | 'step' | 'smooth'): string {
		if (!pts.length) return '';
		if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
		if (interp === 'step') {
			let d = `M ${pts[0].x} ${pts[0].y}`;
			for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i - 1].y} L ${pts[i].x} ${pts[i].y}`;
			return d;
		}
		if (interp === 'smooth') {
			let d = `M ${pts[0].x} ${pts[0].y}`;
			for (let i = 0; i < pts.length - 1; i++) {
				const p0 = pts[i - 1] ?? pts[i];
				const p1 = pts[i];
				const p2 = pts[i + 1];
				const p3 = pts[i + 2] ?? p2;
				const c1x = p1.x + (p2.x - p0.x) / 6;
				const c1y = p1.y + (p2.y - p0.y) / 6;
				const c2x = p2.x - (p3.x - p1.x) / 6;
				const c2y = p2.y - (p3.y - p1.y) / 6;
				d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
			}
			return d;
		}
		return `M ${pts[0].x} ${pts[0].y}` + pts.slice(1).map((p) => ` L ${p.x} ${p.y}`).join('');
	}

	const layout = $derived.by(() => {
		const all = series.flatMap((s) => s.points);
		if (!all.length) return null;
		const xIsNum = all.every((p) => typeof p.x === 'number');
		const cats: string[] = [];
		if (!xIsNum) {
			for (const s of series)
				for (const p of s.points) {
					const key = String(p.x);
					if (!cats.includes(key)) cats.push(key);
				}
		}
		const xs = all.filter((p) => typeof p.x === 'number').map((p) => p.x as number);
		const xMin = xIsNum ? Math.min(...xs) : 0;
		const xMax = xIsNum ? Math.max(...xs) : 0;
		const xPos = (rawX: number | string, k: number): number => {
			if (xIsNum) return L + ((Number(rawX) - xMin) / (xMax - xMin || 1)) * plotW;
			const idx = cats.indexOf(String(rawX));
			const i = idx >= 0 ? idx : k;
			return L + (cats.length > 1 ? i / (cats.length - 1) : 0.5) * plotW;
		};

		const stack = stacked && mode !== 'scatter';
		const maxLen = Math.max(...series.map((s) => s.points.length), 0);

		let dataMin = Infinity;
		let dataMax = -Infinity;
		if (stack) {
			dataMin = 0;
			for (let k = 0; k < maxLen; k++) {
				let sum = 0;
				for (const s of series) sum += s.points[k]?.y ?? 0;
				if (sum > dataMax) dataMax = sum;
			}
			if (dataMax === -Infinity) dataMax = 1;
		} else {
			for (const p of all) {
				if (p.y < dataMin) dataMin = p.y;
				if (p.y > dataMax) dataMax = p.y;
			}
		}
		const yTicks = axisTicks(dataMin, dataMax, 5);
		const dMin = Math.min(yTicks[0], dataMin);
		const dMax = Math.max(yTicks[yTicks.length - 1], dataMax);
		const yScale = (y: number) => baseY - ((y - dMin) / (dMax - dMin || 1)) * plotH;
		const zeroY = yScale(Math.max(dMin, Math.min(0, dMax)));

		const plotted = series.map((s, si) => {
			const color = seriesColor(s, si);
			const interp = s.interpolation ?? 'linear';
			const top: Pt[] = s.points.map((p, k) => {
				let yVal = p.y;
				if (stack) {
					let sum = 0;
					for (let j = 0; j <= si; j++) sum += series[j].points[k]?.y ?? 0;
					yVal = sum;
				}
				return { x: xPos(p.x, k), y: yScale(yVal) };
			});
			const linePath = buildPath(top, interp);
			let areaPath = '';
			if (mode === 'area' && top.length) {
				if (stack) {
					const bot: Pt[] = s.points.map((p, k) => {
						let sum = 0;
						for (let j = 0; j < si; j++) sum += series[j].points[k]?.y ?? 0;
						return { x: xPos(p.x, k), y: yScale(sum) };
					});
					areaPath =
						buildPath(top, interp) +
						' L ' +
						bot.slice().reverse().map((pt) => `${pt.x} ${pt.y}`).join(' L ') +
						' Z';
				} else {
					areaPath =
						buildPath(top, interp) +
						` L ${top[top.length - 1].x} ${zeroY} L ${top[0].x} ${zeroY} Z`;
				}
			}
			return { id: s.id, name: s.name, color, top, linePath, areaPath };
		});

		const xTickItems = xIsNum
			? axisTicks(xMin, xMax, 6)
					.filter((t) => t >= xMin - 1e-9 && t <= xMax + 1e-9)
					.map((t) => ({ x: L + ((t - xMin) / (xMax - xMin || 1)) * plotW, label: formatNumber(t) }))
			: cats.map((c, i) => ({
					x: L + (cats.length > 1 ? i / (cats.length - 1) : 0.5) * plotW,
					label: c.length > 10 ? c.slice(0, 9) + '…' : c
				}));
		const yTickItems = yTicks.map((t) => ({ y: yScale(t), label: formatNumber(t) }));

		return { plotted, xTickItems, yTickItems };
	});

	let svgEl: SVGSVGElement | null = $state(null);
	export function capturePng(): Promise<string | null> {
		return svgEl ? svgToPng(svgEl, VBW, VBH, '#050a14') : Promise.resolve(null);
	}
</script>

<div class="chart-root">
	<svg bind:this={svgEl} viewBox="0 0 {VBW} {VBH}" preserveAspectRatio="xMidYMid meet" style="font-family: {font};">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<rect x="0" y="0" width={VBW} height={VBH} fill="transparent" onclick={() => onSelect(null)} role="presentation" />

		{#if layout}
			<!-- y gridlines + labels -->
			{#each layout.yTickItems as t}
				<line x1={L} y1={t.y} x2={L + plotW} y2={t.y} stroke="rgba(255,255,255,0.08)" stroke-width="1" />
				<text x={L - 10} y={t.y + 4} text-anchor="end" font-size="12" fill="rgba(255,255,255,0.45)">{t.label}</text>
			{/each}

			<!-- x labels -->
			{#each layout.xTickItems as t}
				<text x={t.x} y={baseY + 20} text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.55)">{t.label}</text>
			{/each}

			<!-- areas first (under lines) -->
			{#if mode === 'area'}
				{#each layout.plotted as p (p.id)}
					{#if p.areaPath}
						<path
							d={p.areaPath}
							fill={p.color}
							fill-opacity={selectedId && p.id !== selectedId ? 0.06 : 0.18}
							stroke="none"
						/>
					{/if}
				{/each}
			{/if}

			<!-- lines / hit areas / dots -->
			{#each layout.plotted as p (p.id)}
				{@const dim = selectedId && p.id !== selectedId}
				{#if mode !== 'scatter'}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<path
						data-series-id={p.id}
						d={p.linePath}
						fill="none"
						stroke={p.color}
						stroke-width={p.id === selectedId ? 3 : 2}
						stroke-opacity={dim ? 0.3 : 1}
						stroke-linejoin="round"
						stroke-linecap="round"
						style="cursor: pointer;"
						onclick={(e) => { e.stopPropagation(); onSelect(p.id); }}
						role="presentation"
					/>
					<!-- fat invisible hit target -->
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<path
						data-series-id={p.id}
						d={p.linePath}
						fill="none"
						stroke="transparent"
						stroke-width="14"
						style="cursor: pointer;"
						onclick={(e) => { e.stopPropagation(); onSelect(p.id); }}
						role="presentation"
					/>
				{/if}
				{#if mode === 'scatter' || showDots}
					{#each p.top as pt}
						<circle
							cx={pt.x}
							cy={pt.y}
							r={p.id === selectedId ? 4 : 3}
							fill={p.color}
							fill-opacity={dim ? 0.3 : 1}
						/>
					{/each}
				{/if}
			{/each}

			<!-- axis baseline -->
			<line x1={L} y1={baseY} x2={L + plotW} y2={baseY} stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />

			<!-- legend -->
			{#if series.length > 1}
				{#each layout.plotted as p, i (p.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<g
						data-series-id={p.id}
						transform="translate({L + i * 130}, 16)"
						style="cursor: pointer;"
						onclick={(e) => { e.stopPropagation(); onSelect(p.id); }}
						role="presentation"
						opacity={selectedId && p.id !== selectedId ? 0.45 : 1}
					>
						<rect x="0" y="-9" width="12" height="12" rx="2" fill={p.color} />
						<text x="18" y="1" font-size="12" fill="#cdd8ef" dominant-baseline="middle">
							{p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name}
						</text>
					</g>
				{/each}
			{/if}
		{:else}
			<text x={VBW / 2} y={VBH / 2} text-anchor="middle" font-size="15" fill="rgba(255,255,255,0.4)">
				No data — add a series
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
</style>

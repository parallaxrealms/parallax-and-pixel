<script lang="ts">
	/**
	 * RadarScene — native-SVG spider/radar over VizData.radar. Draws a concentric
	 * N-gon grid (rings + spokes), then one filled polygon per series with a soft
	 * radial-gradient fill, a glow, value dots with halos, and axis labels just
	 * outside each vertex. Ported from the bespoke AgentRadar geometry and extended
	 * to overlay MULTIPLE series. Themeable via --mode-* tokens; no chart library.
	 */
	import type { VizRadar } from '../schema';
	import { CHART_PALETTE, CONTENT_FONT, svgToPng } from '../chart-utils';

	interface Props {
		radar: VizRadar;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let { radar, contentFont = 'sans' }: Props = $props();

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);

	// Fixed drawing box (geometry centered in a size×size square), with extra
	// padding around it so edge-anchored axis labels aren't clipped — mirrors
	// AgentRadar's padX/padY approach.
	const SIZE = 260;
	const PAD_X = 64; // horizontal room for the longest side labels
	const PAD_Y = 34; // vertical room for the top/bottom labels
	const RINGS = 4; // concentric grid rings

	const cx = SIZE / 2;
	const cy = SIZE / 2;
	const radius = SIZE / 2 - 6; // labels live in the pad, so use nearly the full box
	const vbX = -PAD_X;
	const vbY = -PAD_Y;
	const vbW = SIZE + PAD_X * 2;
	const vbH = SIZE + PAD_Y * 2;

	const axes = $derived(radar.axes ?? []);
	const n = $derived(Math.max(axes.length, 1));
	const series = $derived(radar.series ?? []);

	// Outer-ring value: explicit max, else the largest value across all series, else 5.
	const max = $derived.by(() => {
		if (typeof radar.max === 'number' && radar.max > 0) return radar.max;
		let hi = 0;
		for (const s of series) for (const v of s.values ?? []) if (v > hi) hi = v;
		return hi > 0 ? hi : 5;
	});

	// Angle for axis i: start at top (-90deg), go clockwise.
	function angleFor(i: number): number {
		return (Math.PI * 2 * i) / n - Math.PI / 2;
	}
	function pointAt(i: number, frac: number): { x: number; y: number } {
		const a = angleFor(i);
		return { x: cx + Math.cos(a) * radius * frac, y: cy + Math.sin(a) * radius * frac };
	}
	function gridPolygon(frac: number): string {
		return Array.from({ length: n }, (_, i) => {
			const p = pointAt(i, frac);
			return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
		}).join(' ');
	}

	const ringFracs = $derived(Array.from({ length: RINGS }, (_, r) => (r + 1) / RINGS));
	const spokeTips = $derived(Array.from({ length: n }, (_, i) => pointAt(i, 1)));

	// Resolve a series color: explicit override, else the mode primary for the
	// first series, else the themed palette by index.
	function colorFor(i: number, override?: string): string {
		if (override) return override;
		if (i === 0) return 'var(--accent-primary, #00a5cf)';
		return CHART_PALETTE[i % CHART_PALETTE.length];
	}

	// Per-series geometry: clamped vertices, the polygon points string, and a
	// stable gradient id.
	const rendered = $derived.by(() =>
		series.map((s, i) => {
			const color = colorFor(i, s.color);
			const verts = Array.from({ length: n }, (_, ax) => {
				const v = Math.max(0, Math.min(max, s.values?.[ax] ?? 0));
				return pointAt(ax, max > 0 ? v / max : 0);
			});
			const points = verts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
			return { id: s.id, name: s.name, color, verts, points, gradId: `radar-grad-${s.id}` };
		})
	);

	// Axis label anchor + position just outside each vertex (by angle, like AgentRadar).
	const labels = $derived(
		Array.from({ length: n }, (_, i) => {
			const p = pointAt(i, 1.14);
			const a = angleFor(i);
			const cosv = Math.cos(a);
			let anchor: 'start' | 'middle' | 'end' = 'middle';
			if (cosv > 0.2) anchor = 'start';
			else if (cosv < -0.2) anchor = 'end';
			return { x: p.x, y: p.y, anchor, text: axes[i] ?? '' };
		})
	);

	const showLegend = $derived(rendered.length > 1);

	let svgEl: SVGSVGElement | null = $state(null);
	export function capturePng(): Promise<string | null> {
		return svgEl ? svgToPng(svgEl, vbW, vbH, '#050a14') : Promise.resolve(null);
	}
</script>

<div class="chart-root">
	<svg
		bind:this={svgEl}
		viewBox="{vbX} {vbY} {vbW} {vbH}"
		preserveAspectRatio="xMidYMid meet"
		role="img"
		aria-label="Radar chart{axes.length ? ` across ${axes.join(', ')}` : ''}"
		style="font-family: {font};"
	>
		<defs>
			{#each rendered as r (r.id)}
				<radialGradient id={r.gradId} cx="50%" cy="50%" r="50%">
					<stop offset="0%" stop-color={r.color} stop-opacity="0.28" />
					<stop offset="100%" stop-color={r.color} stop-opacity="0.1" />
				</radialGradient>
			{/each}
			<filter id="radar-glow" x="-30%" y="-30%" width="160%" height="160%">
				<feGaussianBlur stdDeviation="2.5" />
			</filter>
		</defs>

		<!-- Grid rings -->
		{#each ringFracs as frac (frac)}
			<polygon
				points={gridPolygon(frac)}
				fill="none"
				stroke="rgb(51 65 85)"
				stroke-width="1"
				opacity={frac === 1 ? 0.6 : 0.28}
			/>
		{/each}

		<!-- Spokes -->
		{#each spokeTips as tip, i (i)}
			<line
				x1={cx}
				y1={cy}
				x2={tip.x}
				y2={tip.y}
				stroke="rgb(51 65 85)"
				stroke-width="1"
				opacity="0.28"
			/>
		{/each}

		<!-- Series polygons (glow → gradient fill → stroke), back to front -->
		{#each rendered as r (r.id)}
			<g data-series-id={r.id}>
				<!-- soft glow under the stroke -->
				<polygon
					points={r.points}
					fill="none"
					stroke={r.color}
					stroke-width="5"
					stroke-linejoin="round"
					opacity="0.35"
					filter="url(#radar-glow)"
				/>
				<!-- gradient fill -->
				<polygon points={r.points} fill="url(#{r.gradId})" stroke="none" />
				<!-- crisp stroke -->
				<polygon
					points={r.points}
					fill="none"
					stroke={r.color}
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
				<!-- value dots with faint halo -->
				{#each r.verts as v, ax (ax)}
					<circle cx={v.x} cy={v.y} r="5.5" fill={r.color} opacity="0.18" />
					<circle cx={v.x} cy={v.y} r="2.5" fill={r.color} />
				{/each}
			</g>
		{/each}

		<!-- Axis labels -->
		{#each labels as label, i (i)}
			<text
				x={label.x}
				y={label.y}
				text-anchor={label.anchor}
				dominant-baseline="middle"
				fill="rgb(148 163 184)"
				font-size="10"
				class="axis-label"
			>
				{label.text}
			</text>
		{/each}

		<!-- Legend (multi-series only) -->
		{#if showLegend}
			{#each rendered as r, i (r.id)}
				<g transform="translate({vbX + 6}, {vbY + 14 + i * 18})">
					<rect x="0" y="-7" width="11" height="11" rx="2.5" fill={r.color} />
					<text
						x="18"
						y="0"
						font-size="10.5"
						fill="#e2e8f0"
						dominant-baseline="middle"
					>
						{r.name.length > 20 ? r.name.slice(0, 19) + '…' : r.name}
					</text>
				</g>
			{/each}
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
		height: auto;
		max-width: 520px;
		max-height: 100%;
	}
	.axis-label {
		user-select: none;
	}
</style>

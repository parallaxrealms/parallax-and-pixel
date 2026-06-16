<script lang="ts">
	/**
	 * StatScene — native-SVG single big-number panel over VizData.scalar.
	 * Shows value + unit, optional caption, and a delta trend arrow colored by
	 * direction (respecting higherIsBetter). Color resolves from thresholds.
	 */
	import type { VizScalar } from '../schema';
	import { scalarColor, formatNumber, svgToPng, CONTENT_FONT } from '../chart-utils';

	interface Props {
		scalar: VizScalar;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let { scalar, contentFont = 'sans' }: Props = $props();

	const VBW = 800;
	const VBH = 460;

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);
	const color = $derived(scalarColor(scalar));
	const deltaGood = $derived(
		scalar.delta == null
			? null
			: (scalar.higherIsBetter ?? true) === scalar.delta >= 0
	);
	const deltaColor = $derived(deltaGood == null ? '#94a3b8' : deltaGood ? '#34d399' : '#f87171');

	// Inline sparkline path from scalar.spark (recent values), drawn under the number.
	const sparkPath = $derived.by(() => {
		const v = scalar.spark;
		if (!v || v.length < 2) return null;
		const w = 280;
		const h = 46;
		const x0 = VBW / 2 - w / 2;
		const y0 = 360;
		const lo = Math.min(...v);
		const hi = Math.max(...v);
		const span = hi - lo || 1;
		const step = w / (v.length - 1);
		return v
			.map((y, i) => {
				const px = x0 + i * step;
				const py = y0 + h - ((y - lo) / span) * h;
				return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
			})
			.join(' ');
	});

	let svgEl: SVGSVGElement | null = $state(null);
	export function capturePng(): Promise<string | null> {
		return svgEl ? svgToPng(svgEl, VBW, VBH, '#050a14') : Promise.resolve(null);
	}
</script>

<div class="chart-root">
	<svg bind:this={svgEl} viewBox="0 0 {VBW} {VBH}" preserveAspectRatio="xMidYMid meet" style="font-family: {font};">
		{#if scalar.label}
			<text x={VBW / 2} y="150" text-anchor="middle" font-size="22" fill="rgba(255,255,255,0.6)" letter-spacing="0.04em">
				{scalar.label}
			</text>
		{/if}

		<text x={VBW / 2} y="270" text-anchor="middle" font-size="120" font-weight="800" fill={color}>
			{formatNumber(scalar.value)}<tspan font-size="56" font-weight="600" fill="rgba(255,255,255,0.55)" dx="6">{scalar.unit ?? ''}</tspan>
		</text>

		{#if scalar.delta != null}
			<g transform="translate({VBW / 2}, 330)">
				<text text-anchor="middle" font-size="26" font-weight="600" fill={deltaColor}>
					{scalar.delta >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(scalar.delta))}{scalar.unit ?? ''}
				</text>
			</g>
		{/if}

		{#if sparkPath}
			<path
				d={sparkPath}
				fill="none"
				stroke={color}
				stroke-width="2.5"
				stroke-linejoin="round"
				stroke-linecap="round"
				opacity="0.9"
			/>
		{/if}

		{#if scalar.target != null}
			<text x={VBW / 2} y={sparkPath ? 432 : 395} text-anchor="middle" font-size="16" fill="rgba(255,255,255,0.4)">
				target {formatNumber(scalar.target)}{scalar.unit ?? ''}
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
		padding: 1.5rem;
	}
	svg {
		width: 100%;
		height: 100%;
		max-height: 100%;
	}
</style>

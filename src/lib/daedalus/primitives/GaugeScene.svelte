<script lang="ts">
	/**
	 * GaugeScene — native-SVG radial gauge over VizData.scalar. A 240° arc
	 * (open at the bottom); the filled portion maps value within [min,max] and
	 * is colored by the active threshold band.
	 */
	import type { VizScalar } from '../schema';
	import { scalarColor, rangeFraction, formatNumber, svgToPng, CONTENT_FONT } from '../chart-utils';

	interface Props {
		scalar: VizScalar;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let { scalar, contentFont = 'sans' }: Props = $props();

	const VBW = 800;
	const VBH = 460;
	const CX = 400;
	const CY = 280;
	const RAD = 165;
	const SW = 38;
	const START = 150; // degrees (lower-left)
	const SWEEP = 240; // degrees, increasing → over the top → lower-right

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);
	const min = $derived(scalar.min ?? 0);
	const max = $derived(scalar.max ?? 100);
	const frac = $derived(rangeFraction(scalar.value, min, max));
	const color = $derived(scalarColor(scalar));

	function pt(r: number, deg: number) {
		const a = (deg * Math.PI) / 180;
		return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
	}
	function arc(a0: number, a1: number, r: number): string {
		const p0 = pt(r, a0);
		const p1 = pt(r, a1);
		const large = a1 - a0 > 180 ? 1 : 0;
		return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
	}
	const trackD = $derived(arc(START, START + SWEEP, RAD));
	const valueD = $derived(arc(START, START + SWEEP * frac, RAD));
	const minPt = $derived(pt(RAD + 30, START));
	const maxPt = $derived(pt(RAD + 30, START + SWEEP));

	let svgEl: SVGSVGElement | null = $state(null);
	export function capturePng(): Promise<string | null> {
		return svgEl ? svgToPng(svgEl, VBW, VBH, '#050a14') : Promise.resolve(null);
	}
</script>

<div class="chart-root">
	<svg bind:this={svgEl} viewBox="0 0 {VBW} {VBH}" preserveAspectRatio="xMidYMid meet" style="font-family: {font};">
		<path d={trackD} fill="none" stroke="rgba(255,255,255,0.1)" stroke-width={SW} stroke-linecap="round" />
		{#if frac > 0}
			<path d={valueD} fill="none" stroke={color} stroke-width={SW} stroke-linecap="round" />
		{/if}

		<text x={CX} y={CY - 6} text-anchor="middle" font-size="76" font-weight="800" fill="#fff">
			{formatNumber(scalar.value)}<tspan font-size="34" font-weight="600" fill="rgba(255,255,255,0.55)" dx="4">{scalar.unit ?? ''}</tspan>
		</text>
		{#if scalar.label}
			<text x={CX} y={CY + 34} text-anchor="middle" font-size="18" fill="rgba(255,255,255,0.55)">{scalar.label}</text>
		{/if}

		<text x={minPt.x} y={minPt.y + 4} text-anchor="middle" font-size="15" fill="rgba(255,255,255,0.45)">{formatNumber(min)}</text>
		<text x={maxPt.x} y={maxPt.y + 4} text-anchor="middle" font-size="15" fill="rgba(255,255,255,0.45)">{formatNumber(max)}</text>
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

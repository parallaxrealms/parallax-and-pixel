<script lang="ts">
	/**
	 * BulletScene — native-SVG bullet graph (Tufte): a horizontal measure bar over
	 * qualitative threshold bands with a target marker. Compact KPI-vs-target;
	 * reuses VizScalar verbatim (value/min/max/target/thresholds).
	 */
	import type { VizScalar } from '../schema';
	import { scalarColor, rangeFraction, formatNumber, svgToPng, CONTENT_FONT } from '../chart-utils';

	interface Props {
		scalar: VizScalar;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let { scalar, contentFont = 'sans' }: Props = $props();

	const VBW = 800;
	const VBH = 200;
	const L = 40;
	const R = 40;
	const TRACK_Y = 110;
	const TRACK_H = 44;
	const trackW = VBW - L - R;

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);
	const min = $derived(scalar.min ?? 0);
	const max = $derived(scalar.max ?? 100);
	const color = $derived(scalarColor(scalar));
	const valX = $derived(L + rangeFraction(scalar.value, min, max) * trackW);

	// Qualitative bands from thresholds: each band spans [at, nextAt], shaded by
	// its threshold color at low opacity (light → the measure bar reads on top).
	const bands = $derived.by(() => {
		const t = [...(scalar.thresholds ?? [])].sort((a, b) => a.at - b.at);
		if (!t.length) return [{ x0: L, x1: L + trackW, color: '#1e293b' }];
		const out: { x0: number; x1: number; color: string }[] = [];
		for (let i = 0; i < t.length; i++) {
			const start = Math.max(min, t[i].at);
			const end = i + 1 < t.length ? t[i + 1].at : max;
			out.push({
				x0: L + rangeFraction(start, min, max) * trackW,
				x1: L + rangeFraction(end, min, max) * trackW,
				color: t[i].color
			});
		}
		return out;
	});
	const targetX = $derived(scalar.target != null ? L + rangeFraction(scalar.target, min, max) * trackW : null);

	let svgEl: SVGSVGElement | null = $state(null);
	export function capturePng(): Promise<string | null> {
		return svgEl ? svgToPng(svgEl, VBW, VBH, '#050a14') : Promise.resolve(null);
	}
</script>

<div class="chart-root">
	<svg bind:this={svgEl} viewBox="0 0 {VBW} {VBH}" preserveAspectRatio="xMidYMid meet" style="font-family: {font};">
		{#if scalar.label}
			<text x={L} y="54" font-size="22" font-weight="600" fill="#e6edf7">{scalar.label}</text>
		{/if}
		<text x={VBW - R} y="54" text-anchor="end" font-size="30" font-weight="800" fill={color}>
			{formatNumber(scalar.value)}<tspan font-size="18" font-weight="600" fill="rgba(255,255,255,0.5)" dx="3">{scalar.unit ?? ''}</tspan>
		</text>

		<!-- qualitative bands -->
		{#each bands as b}
			<rect x={b.x0} y={TRACK_Y} width={Math.max(0, b.x1 - b.x0)} height={TRACK_H} fill={b.color} fill-opacity="0.22" />
		{/each}

		<!-- measure bar -->
		<rect x={L} y={TRACK_Y + TRACK_H / 2 - 8} width={Math.max(0, valX - L)} height="16" rx="2" fill={color} />

		<!-- target marker -->
		{#if targetX != null}
			<line x1={targetX} y1={TRACK_Y - 6} x2={targetX} y2={TRACK_Y + TRACK_H + 6} stroke="#fff" stroke-width="3" />
		{/if}

		<!-- min / max -->
		<text x={L} y={TRACK_Y + TRACK_H + 24} font-size="13" fill="rgba(255,255,255,0.45)">{formatNumber(min)}</text>
		<text x={L + trackW} y={TRACK_Y + TRACK_H + 24} text-anchor="end" font-size="13" fill="rgba(255,255,255,0.45)">{formatNumber(max)}</text>
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
		max-width: 880px;
		height: auto;
	}
</style>

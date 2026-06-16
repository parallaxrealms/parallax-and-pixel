<script lang="ts">
	/**
	 * BarScene — native-SVG vertical bar chart over VizData.categories.
	 * No charting dep; inline presentation attributes keep PNG export faithful.
	 * Click a bar to select; data-category-id drives the studio context menu.
	 */
	import type { VizCategory } from '../schema';
	import { categoryColor, formatNumber, svgToPng, CONTENT_FONT } from '../chart-utils';

	interface Props {
		categories: VizCategory[];
		selectedId: string | null;
		onSelect: (id: string | null) => void;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let { categories, selectedId, onSelect, contentFont = 'sans' }: Props = $props();

	const VBW = 800;
	const VBH = 460;
	const L = 56;
	const R = 28;
	const T = 36;
	const B = 70;
	const plotW = VBW - L - R;
	const plotH = VBH - T - B;
	const baseY = T + plotH;

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);
	const maxVal = $derived(Math.max(1, ...categories.map((c) => c.value)));
	const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, v: maxVal * f, y: baseY - f * plotH })));

	const bars = $derived.by(() => {
		const n = categories.length || 1;
		const slot = plotW / n;
		const barW = Math.min(slot * 0.62, 110);
		return categories.map((c, i) => {
			const h = (c.value / maxVal) * plotH;
			return {
				...c,
				x: L + slot * i + (slot - barW) / 2,
				y: baseY - h,
				w: barW,
				h: Math.max(0, h),
				cx: L + slot * i + slot / 2,
				color: categoryColor(c, i)
			};
		});
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

		<!-- gridlines + y ticks -->
		{#each ticks as t}
			<line x1={L} y1={t.y} x2={L + plotW} y2={t.y} stroke="rgba(255,255,255,0.08)" stroke-width="1" />
			<text x={L - 10} y={t.y + 4} text-anchor="end" font-size="13" fill="rgba(255,255,255,0.45)">{formatNumber(t.v)}</text>
		{/each}

		{#each bars as b (b.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<g
				data-category-id={b.id}
				class="bar"
				class:selected={b.id === selectedId}
				onclick={(e) => { e.stopPropagation(); onSelect(b.id); }}
				role="button"
				tabindex="-1"
			>
				<rect
					x={b.x}
					y={b.y}
					width={b.w}
					height={b.h}
					rx="3"
					fill={b.color}
					fill-opacity={selectedId && b.id !== selectedId ? 0.45 : 0.92}
					stroke={b.id === selectedId ? '#f5a623' : 'none'}
					stroke-width="2"
				/>
				<text x={b.cx} y={b.y - 8} text-anchor="middle" font-size="14" font-weight="600" fill="#fff">
					{formatNumber(b.value)}
				</text>
				<text x={b.cx} y={baseY + 19} text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.7)">
					{b.label.length > 24 ? b.label.slice(0, 23) + '…' : b.label}
				</text>
			</g>
		{/each}

		<line x1={L} y1={baseY} x2={L + plotW} y2={baseY} stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />
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
	.bar {
		cursor: pointer;
	}
	.bar rect {
		transition: fill-opacity 0.15s ease;
	}
</style>

<script lang="ts">
	/**
	 * PieScene — native-SVG donut chart over VizData.categories, with a legend.
	 * Click a slice (or legend row) to select; data-category-id drives the menu.
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
	const CX = 250;
	const CY = 230;
	const R = 165;
	const INNER = 95;

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);
	const total = $derived(Math.max(0, categories.reduce((s, c) => s + Math.max(0, c.value), 0)));

	function pt(cx: number, cy: number, r: number, a: number) {
		return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
	}
	function donutPath(a0: number, a1: number, pop: number, color: string): string {
		// pop = radial offset for selected slice
		const mid = (a0 + a1) / 2;
		const ox = pop * Math.cos(mid);
		const oy = pop * Math.sin(mid);
		const large = a1 - a0 > Math.PI ? 1 : 0;
		const o0 = pt(CX + ox, CY + oy, R, a0);
		const o1 = pt(CX + ox, CY + oy, R, a1);
		const i1 = pt(CX + ox, CY + oy, INNER, a1);
		const i0 = pt(CX + ox, CY + oy, INNER, a0);
		return `M ${o0.x} ${o0.y} A ${R} ${R} 0 ${large} 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${INNER} ${INNER} 0 ${large} 0 ${i0.x} ${i0.y} Z`;
	}

	const slices = $derived.by(() => {
		let a = -Math.PI / 2; // start at 12 o'clock
		return categories.map((c, i) => {
			const frac = total > 0 ? Math.max(0, c.value) / total : 0;
			const a0 = a;
			const a1 = a + frac * Math.PI * 2;
			a = a1;
			return { ...c, a0, a1, frac, color: categoryColor(c, i) };
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

		{#each slices as s (s.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<path
				data-category-id={s.id}
				d={donutPath(s.a0, s.a1, s.id === selectedId ? 12 : 0, s.color)}
				fill={s.color}
				fill-opacity={selectedId && s.id !== selectedId ? 0.4 : 0.92}
				stroke="#050a14"
				stroke-width="2"
				class="slice"
				onclick={(e) => { e.stopPropagation(); onSelect(s.id); }}
				role="button"
				tabindex="-1"
			/>
		{/each}

		<!-- donut center: total -->
		<text x={CX} y={CY - 4} text-anchor="middle" font-size="34" font-weight="700" fill="#fff">{formatNumber(total)}</text>
		<text x={CX} y={CY + 20} text-anchor="middle" font-size="13" fill="rgba(255,255,255,0.5)" letter-spacing="0.08em">TOTAL</text>

		<!-- legend -->
		{#each slices as s, i (s.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<g
				data-category-id={s.id}
				transform="translate(500, {72 + i * 34})"
				class="legend"
				class:dim={selectedId && s.id !== selectedId}
				onclick={(e) => { e.stopPropagation(); onSelect(s.id); }}
				role="button"
				tabindex="-1"
			>
				<rect x="0" y="-11" width="14" height="14" rx="3" fill={s.color} />
				<text x="24" y="0" font-size="14" fill="#e6edf7" dominant-baseline="middle">
					{s.label.length > 18 ? s.label.slice(0, 17) + '…' : s.label}
				</text>
				<text x="270" y="0" font-size="14" font-weight="600" fill="#fff" text-anchor="end" dominant-baseline="middle">
					{Math.round(s.frac * 100)}%
				</text>
			</g>
		{/each}
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
	.slice {
		cursor: pointer;
		transition: fill-opacity 0.15s ease;
	}
	.legend {
		cursor: pointer;
	}
	.legend.dim {
		opacity: 0.5;
	}
</style>

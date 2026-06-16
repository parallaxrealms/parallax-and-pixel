<script lang="ts">
	/**
	 * TimelineScene — native-SVG renderer for the timeline primitive.
	 * One horizontal row per track; segments are sharp bars spanning [start,end]
	 * on a shared time domain (min start … max end across all tracks). Segment
	 * color comes from segment.color, else a stable palette keyed on segment.state.
	 * Start/end values may be epoch ms, ISO date strings, or plain numbers — a
	 * tolerant parser normalizes them and flags whether the domain is dates so the
	 * axis formats accordingly. No charting dep.
	 */
	import type { VizTimelineTrack } from '../schema';
	import { categoryColor, axisTicks, formatNumber, svgToPng, CONTENT_FONT } from '../chart-utils';

	interface Props {
		timeline: VizTimelineTrack[];
		selectedId: string | null; // track id
		onSelect: (id: string | null) => void;
		contentFont?: 'sans' | 'mono' | 'serif';
	}
	let { timeline, selectedId, onSelect, contentFont = 'sans' }: Props = $props();

	const VBW = 820;
	const L = 150; // left gutter for track labels
	const R = 24;
	const T = 30;
	const B = 54;
	const ROW_H = 34;
	const ROW_GAP = 8;
	const LEGEND_H = 26;

	const plotW = VBW - L - R;

	const font = $derived(CONTENT_FONT[contentFont] ?? CONTENT_FONT.sans);

	/**
	 * Tolerant time parser: prefer numeric (epoch ms or plain numbers) via
	 * Number(); fall back to Date.parse() for ISO strings. Returns the numeric
	 * position plus whether this value was parsed as a date (so the axis can
	 * format ticks as dates vs. numbers).
	 */
	function parseTime(v: number | string): { pos: number; isDate: boolean } | null {
		if (typeof v === 'number') {
			return Number.isFinite(v) ? { pos: v, isDate: false } : null;
		}
		const s = String(v).trim();
		if (s === '') return null;
		const n = Number(s);
		if (Number.isFinite(n)) return { pos: n, isDate: false };
		const d = Date.parse(s);
		if (Number.isFinite(d)) return { pos: d, isDate: true };
		return null;
	}

	const layout = $derived.by(() => {
		const tracks = timeline ?? [];
		if (!tracks.length) return null;

		// Gather parsed segments, track the global domain + whether any value is a date.
		let domainIsDate = false;
		let dMin = Infinity;
		let dMax = -Infinity;
		let anySegment = false;

		const parsedTracks = tracks.map((track) => {
			const segs = (track.segments ?? [])
				.map((seg, si) => {
					const ps = parseTime(seg.start);
					const pe = parseTime(seg.end);
					if (!ps || !pe) return null;
					if (ps.isDate || pe.isDate) domainIsDate = true;
					const lo = Math.min(ps.pos, pe.pos);
					const hi = Math.max(ps.pos, pe.pos);
					if (lo < dMin) dMin = lo;
					if (hi > dMax) dMax = hi;
					anySegment = true;
					return { lo, hi, state: seg.state, label: seg.label, color: seg.color, key: si };
				})
				.filter((s): s is NonNullable<typeof s> => s !== null);
			return { id: track.id, label: track.label, segs };
		});

		if (!anySegment || dMin === Infinity) {
			return { empty: true as const, parsedTracks, domainIsDate };
		}

		// Stable state → color index map (first-seen order), so a state is always
		// the same color across the whole timeline.
		const stateIndex = new Map<string, number>();
		const stateColor = (state: string | undefined): string => {
			const key = state ?? '';
			if (!stateIndex.has(key)) stateIndex.set(key, stateIndex.size);
			return categoryColor({}, stateIndex.get(key)!);
		};

		const xScale = (pos: number) => L + ((pos - dMin) / (dMax - dMin || 1)) * plotW;

		const rows = parsedTracks.map((track, ti) => {
			const y = T + ti * (ROW_H + ROW_GAP);
			const bars = track.segs.map((seg) => {
				const x1 = xScale(seg.lo);
				const x2 = xScale(seg.hi);
				const w = Math.max(1, x2 - x1);
				const color = seg.color ?? stateColor(seg.state);
				const title = seg.label ?? seg.state ?? '';
				return { x: x1, w, color, label: seg.label ?? seg.state ?? '', title, key: seg.key };
			});
			return { id: track.id, label: track.label, y, bars };
		});

		// Legend: distinct states (with a color), excluding segments that only
		// carry an explicit color and no state.
		const legend: { state: string; color: string }[] = [];
		for (const [state, idx] of stateIndex) {
			if (state === '') continue;
			legend.push({ state, color: categoryColor({}, idx) });
		}

		// Time axis ticks across [dMin,dMax].
		const ticks = axisTicks(dMin, dMax, 6)
			.filter((t) => t >= dMin - 1e-6 && t <= dMax + 1e-6)
			.map((t) => ({
				x: xScale(t),
				label: domainIsDate ? new Date(t).toLocaleDateString() : formatNumber(t)
			}));

		const plotH = rows.length * (ROW_H + ROW_GAP) - ROW_GAP;
		const baseY = T + plotH;

		return {
			empty: false as const,
			rows,
			legend,
			ticks,
			baseY,
			plotH,
			domainIsDate
		};
	});

	// Dynamic viewBox height so all rows + axis + legend fit.
	const VBH = $derived.by(() => {
		const n = layout && !layout.empty ? layout.rows.length : 1;
		return T + n * (ROW_H + ROW_GAP) - ROW_GAP + B + LEGEND_H;
	});

	let svgEl: SVGSVGElement | null = $state(null);
	export function capturePng(): Promise<string | null> {
		return svgEl ? svgToPng(svgEl, VBW, VBH, '#050a14') : Promise.resolve(null);
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
		<rect x="0" y="0" width={VBW} height={VBH} fill="transparent" onclick={() => onSelect(null)} role="presentation" />

		{#if layout && !layout.empty}
			{@const baseY = layout.baseY}

			<!-- gridlines along the time axis -->
			{#each layout.ticks as t (t.x)}
				<line x1={t.x} y1={T - 8} x2={t.x} y2={baseY} stroke="rgba(255,255,255,0.08)" stroke-width="1" />
				<text x={t.x} y={baseY + 20} text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.55)">{t.label}</text>
			{/each}

			<!-- rows -->
			{#each layout.rows as row (row.id)}
				{@const sel = selectedId === row.id}
				<!-- row hit area + highlight -->
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<g
					data-track-id={row.id}
					style="cursor: pointer;"
					onclick={(e) => { e.stopPropagation(); onSelect(sel ? null : row.id); }}
					role="presentation"
				>
					<rect
						x="0"
						y={row.y - ROW_GAP / 2}
						width={VBW}
						height={ROW_H + ROW_GAP}
						fill={sel ? 'rgba(77,124,255,0.12)' : 'transparent'}
						stroke={sel ? 'rgba(77,124,255,0.5)' : 'transparent'}
						stroke-width="1"
					/>
					<!-- track label gutter -->
					<text
						x={L - 12}
						y={row.y + ROW_H / 2}
						text-anchor="end"
						dominant-baseline="middle"
						font-size="12"
						fill={sel ? '#cdd8ef' : 'rgba(255,255,255,0.7)'}
						font-weight={sel ? 600 : 400}
					>
						{row.label.length > 20 ? row.label.slice(0, 19) + '…' : row.label}
					</text>
				</g>

				<!-- segment bars (sharp, no radius) -->
				{#each row.bars as bar (bar.key)}
					<g>
						<title>{bar.title}</title>
						<rect
							x={bar.x}
							y={row.y}
							width={bar.w}
							height={ROW_H}
							fill={bar.color}
							fill-opacity={selectedId && selectedId !== row.id ? 0.4 : 0.92}
						/>
						{#if bar.label && bar.w > bar.label.length * 7 + 8}
							<text
								x={bar.x + 6}
								y={row.y + ROW_H / 2}
								dominant-baseline="middle"
								font-size="11"
								fill="#0a0f1c"
								font-weight="600"
								pointer-events="none"
							>
								{bar.label}
							</text>
						{/if}
					</g>
				{/each}
			{/each}

			<!-- left gutter divider + axis baseline -->
			<line x1={L} y1={T - 8} x2={L} y2={baseY} stroke="rgba(255,255,255,0.18)" stroke-width="1" />
			<line x1={L} y1={baseY} x2={L + plotW} y2={baseY} stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />

			<!-- state legend -->
			{#if layout.legend.length}
				{@const ly = baseY + 38}
				{#each layout.legend as item, i (item.state)}
					<g transform="translate({L + i * 130}, {ly})">
						<rect x="0" y="-9" width="12" height="12" fill={item.color} />
						<text x="18" y="1" font-size="12" fill="#cdd8ef" dominant-baseline="middle">
							{item.state.length > 14 ? item.state.slice(0, 13) + '…' : item.state}
						</text>
					</g>
				{/each}
			{/if}
		{:else}
			<text x={VBW / 2} y={VBH / 2} text-anchor="middle" font-size="15" fill="rgba(255,255,255,0.4)">
				No data — add a track
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

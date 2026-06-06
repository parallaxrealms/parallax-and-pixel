<script lang="ts">
	/**
	 * Compact stat tile with optional sparkline. Pure SVG.
	 * Ported from 9realms; structural grays restyled to the p&p slate palette.
	 */
	interface Props {
		label: string;
		value: string;
		valueColor?: string;
		sparkline?: { t: number; v: number | null }[];
		sparkColor?: string;
		hint?: string;
		loading?: boolean;
	}

	let {
		label,
		value,
		valueColor = 'text-slate-100',
		sparkline,
		sparkColor = '#60a5fa',
		hint,
		loading = false
	}: Props = $props();

	const SPARK_W = 100;
	const SPARK_H = 28;

	let sparkPath = $derived.by(() => {
		if (!sparkline || sparkline.length === 0) return '';
		let min = Infinity;
		let max = -Infinity;
		for (const p of sparkline) {
			if (p.v === null || !isFinite(p.v)) continue;
			if (p.v < min) min = p.v;
			if (p.v > max) max = p.v;
		}
		if (!isFinite(min) || !isFinite(max)) return '';
		if (min === max) {
			max = min + 1;
		}
		const tMin = sparkline[0]!.t;
		const tMax = sparkline[sparkline.length - 1]!.t;
		const tRange = tMax - tMin || 1;
		let d = '';
		let pen = false;
		for (const p of sparkline) {
			if (p.v === null || !isFinite(p.v)) {
				pen = false;
				continue;
			}
			const x = ((p.t - tMin) / tRange) * SPARK_W;
			const y = SPARK_H - ((p.v - min) / (max - min)) * SPARK_H;
			d += (pen ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
			pen = true;
		}
		return d.trim();
	});
</script>

<div class="border border-slate-700 bg-slate-900 p-3">
	<div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
	<div class="my-1 font-mono text-2xl font-light {valueColor}">
		{loading ? '…' : value}
	</div>
	{#if sparkline && sparkline.length > 1}
		<svg viewBox="0 0 {SPARK_W} {SPARK_H}" class="block h-7 w-full" preserveAspectRatio="none">
			<path d={sparkPath} fill="none" stroke={sparkColor} stroke-width="1.2" />
		</svg>
	{/if}
	{#if hint}
		<p class="mt-1 text-[10px] leading-snug text-slate-500">{hint}</p>
	{/if}
</div>

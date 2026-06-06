<script lang="ts">
	/**
	 * Three stacked bars for 1m / 5m / 15m load averages, scaled relative
	 * to CPU count if provided (so a 4-core box reads "100% busy" at load=4).
	 * Ported from 9realms; structural grays restyled to the p&p slate palette.
	 */
	interface Props {
		min1: number | null;
		min5: number | null;
		min15: number | null;
		cpuCount?: number;
		loading?: boolean;
	}

	let { min1, min5, min15, cpuCount = 4, loading = false }: Props = $props();

	let max = $derived(Math.max(cpuCount * 1.5, min1 ?? 0, min5 ?? 0, min15 ?? 0, 1));

	function pct(v: number | null): number {
		if (v === null || !isFinite(v)) return 0;
		return Math.max(0, Math.min(100, (v / max) * 100));
	}
	function color(v: number | null): string {
		if (v === null) return '#475569';
		if (v >= cpuCount) return '#ef4444';
		if (v >= cpuCount * 0.75) return '#f59e0b';
		return '#cbd5e1';
	}
	const rows: { label: string; key: '1' | '5' | '15' }[] = [
		{ label: '1m', key: '1' },
		{ label: '5m', key: '5' },
		{ label: '15m', key: '15' }
	];

	function valFor(key: '1' | '5' | '15'): number | null {
		return key === '1' ? min1 : key === '5' ? min5 : min15;
	}
</script>

<div class="border border-slate-700 bg-slate-900/60 p-3">
	<div class="mb-1.5 flex items-baseline justify-between">
		<div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
			Load Average
		</div>
		<div class="text-[10px] text-slate-500">{cpuCount} cores</div>
	</div>
	<div class="space-y-1.5">
		{#each rows as r}
			{@const v = valFor(r.key)}
			<div class="flex items-center gap-2">
				<div class="w-7 shrink-0 font-mono text-[10px] text-slate-500">{r.label}</div>
				<div class="relative h-2 flex-1 overflow-hidden bg-white/[0.04]">
					<!-- cpu-count threshold marker -->
					<div
						class="pointer-events-none absolute top-0 h-full w-px bg-white/30"
						style="left: {Math.min(100, (cpuCount / max) * 100)}%"
					></div>
					<div
						class="h-full transition-all duration-500"
						style="width: {pct(v)}%; background-color: {color(v)};"
					></div>
				</div>
				<div class="w-10 shrink-0 text-right font-mono text-[11px] text-slate-200">
					{loading || v === null ? '·' : v.toFixed(2)}
				</div>
			</div>
		{/each}
	</div>
</div>

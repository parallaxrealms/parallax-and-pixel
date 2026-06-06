<script lang="ts">
	/**
	 * Compact server health card — header (name + role + severity dot),
	 * three radial gauges (CPU / Mem / Disk), load bars, uptime footer.
	 * Modeled on 9realms' HeimdallOverview server-card section, restyled
	 * to the p&p slate admin palette.
	 */
	import type { ComponentType } from 'svelte';
	import RadialGauge from './charts/RadialGauge.svelte';
	import LoadBars from './charts/LoadBars.svelte';
	import type { FsEntry, ServerSnapshot } from './types';

	interface Props {
		name: string;
		role: string;
		icon: ComponentType;
		snapshot: ServerSnapshot | null;
		error: string | null;
		loading?: boolean;
	}

	let { name, role, icon: Icon, snapshot, error, loading = false }: Props = $props();

	let root = $derived.by((): FsEntry | null => {
		if (!snapshot) return null;
		return snapshot.fs.find((f) => f.mnt_point === '/') ?? snapshot.fs[0] ?? null;
	});

	// ok ≤70% / warn 70-88% / crit ≥88% on the worst of cpu/mem/disk.
	let sev = $derived.by((): 'ok' | 'warn' | 'crit' | 'unknown' => {
		if (!snapshot) return 'unknown';
		const vals = [snapshot.cpu.total ?? 0, snapshot.mem.percent ?? 0, root?.percent ?? 0];
		const max = Math.max(...vals);
		if (max >= 88) return 'crit';
		if (max >= 70) return 'warn';
		return 'ok';
	});

	let sevDot = $derived(
		sev === 'crit'
			? 'bg-red-500'
			: sev === 'warn'
				? 'bg-amber-500'
				: sev === 'ok'
					? 'bg-emerald-400'
					: 'bg-slate-600'
	);

	function formatBytes(n: number | null): string {
		if (n === null || !isFinite(n)) return '·';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let i = 0;
		let v = n;
		while (v >= 1024 && i < units.length - 1) {
			v /= 1024;
			i++;
		}
		return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
	}

	function formatUptime(s: number | null): string {
		if (s === null || !isFinite(s)) return '·';
		const days = Math.floor(s / 86400);
		const hours = Math.floor((s % 86400) / 3600);
		if (days > 0) return `${days}d ${hours}h`;
		const mins = Math.floor((s % 3600) / 60);
		return `${hours}h ${mins}m`;
	}
</script>

<section class="border border-slate-700 bg-slate-900/50">
	<div class="h-0.5 bg-accent-primary"></div>
	<header
		class="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-3 py-2"
	>
		<div class="flex items-center gap-2">
			<Icon class="h-4 w-4 text-slate-300" />
			<div>
				<div class="text-sm font-medium tracking-wide text-slate-100">
					{name}
				</div>
				<div class="text-[10px] uppercase tracking-wider text-slate-500">
					{role}
				</div>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<span class="h-2 w-2 rounded-full {sevDot} {sev === 'crit' ? 'animate-pulse' : ''}"></span>
			<span class="text-[10px] uppercase tracking-wider text-slate-400">
				{sev === 'unknown' ? '·' : sev}
			</span>
		</div>
	</header>

	{#if error}
		<div class="p-4 text-[11px] text-red-300">{error}</div>
	{:else}
		<div class="p-3">
			<div class="grid grid-cols-3 gap-2">
				<div class="flex items-center justify-center bg-slate-950/40 p-2">
					<RadialGauge value={snapshot?.cpu.total ?? null} label="CPU" size={96} {loading} />
				</div>
				<div class="flex items-center justify-center bg-slate-950/40 p-2">
					<RadialGauge
						value={snapshot?.mem.percent ?? null}
						label="Mem"
						size={96}
						sublabel={snapshot?.mem.total ? formatBytes(snapshot.mem.total) : undefined}
						{loading}
					/>
				</div>
				<div class="flex items-center justify-center bg-slate-950/40 p-2">
					<RadialGauge
						value={root?.percent ?? null}
						label="Disk"
						size={96}
						sublabel={root?.size ? formatBytes(root.size) : undefined}
						{loading}
					/>
				</div>
			</div>

			<div class="mt-3">
				<LoadBars
					min1={snapshot?.load.min1 ?? null}
					min5={snapshot?.load.min5 ?? null}
					min15={snapshot?.load.min15 ?? null}
					cpuCount={snapshot?.load.cpucore ?? 4}
					{loading}
				/>
			</div>

			<div
				class="mt-3 flex items-center justify-between border-t border-slate-800 pt-2 text-[10px] text-slate-500"
			>
				<span>uptime</span>
				<span class="font-mono text-slate-200">
					{formatUptime(snapshot?.uptime_seconds ?? null)}
				</span>
			</div>
		</div>
	{/if}
</section>

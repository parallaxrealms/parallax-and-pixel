<script lang="ts">
	/**
	 * Admin Service Status tab — detail view for the bottom StatusBar.
	 * Reads the shared serviceStatus store (polled by StatusBar). Lists every
	 * monitored service with its worst-case health, response time, optional
	 * child components, and a link to the upstream status page.
	 *
	 * Ported from 9realms (odin/ServiceStatusTab). The Odin context-menu kit was
	 * replaced with native controls (refresh + per-row external link / expand).
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { Activity, RefreshCw, ExternalLink, ChevronDown, ChevronRight } from 'lucide-svelte';
	import { serviceStatuses, statusLastChecked, statusLoading, fetchServiceStatuses } from '$lib/stores/serviceStatus';
	import type { ServiceHealth, ServiceStatus } from '$lib/types/service-status';

	// Convention: dashboard tabs receive {supabase}. This tab reads the
	// serviceStatus store (server-probed via /api/status/check) so the client
	// is currently unused.
	let { supabase: _supabase } = $props<{ supabase: SupabaseClient }>();

	let expandedCards = $state<Set<string>>(new Set());

	function toggleCard(id: string) {
		const next = new Set(expandedCards);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedCards = next;
	}

	// Auto-expand cards with children on first load
	$effect(() => {
		if ($serviceStatuses.length > 0 && expandedCards.size === 0) {
			const withChildren = $serviceStatuses
				.filter((s) => s.children && s.children.length > 0)
				.map((s) => s.id);
			expandedCards = new Set(withChildren);
		}
	});

	function getStatusColor(status: ServiceHealth): string {
		switch (status) {
			case 'operational':
				return 'bg-emerald-500';
			case 'degraded':
				return 'bg-amber-500';
			case 'down':
				return 'bg-red-500';
			default:
				return 'bg-slate-600';
		}
	}

	function getStatusText(status: ServiceHealth): string {
		switch (status) {
			case 'operational':
				return 'Operational';
			case 'degraded':
				return 'Degraded';
			case 'down':
				return 'Down';
			default:
				return 'Unknown';
		}
	}

	function getStatusBadgeClass(status: ServiceHealth): string {
		switch (status) {
			case 'operational':
				return 'bg-emerald-500/10 text-emerald-400';
			case 'degraded':
				return 'bg-amber-500/15 text-amber-400';
			case 'down':
				return 'bg-red-500/10 text-red-400';
			default:
				return 'bg-slate-500/10 text-slate-400';
		}
	}

	function worstStatus(service: ServiceStatus): ServiceHealth {
		if (!service.children?.length) return service.status;
		const statuses = [service.status, ...service.children.map((c) => c.status)];
		if (statuses.includes('down')) return 'down';
		if (statuses.includes('degraded')) return 'degraded';
		if (statuses.includes('unknown')) return 'unknown';
		return 'operational';
	}

	function relativeTime(iso: string): string {
		if (!iso) return '';
		const diff = Date.now() - new Date(iso).getTime();
		const secs = Math.floor(diff / 1000);
		if (secs < 60) return 'just now';
		const mins = Math.floor(secs / 60);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		return `${hrs}h ago`;
	}

	// Summary counts
	let summary = $derived.by(() => {
		let operational = 0;
		let degraded = 0;
		let down = 0;
		let unknown = 0;
		for (const s of $serviceStatuses) {
			const w = worstStatus(s);
			if (w === 'operational') operational++;
			else if (w === 'degraded') degraded++;
			else if (w === 'down') down++;
			else unknown++;
		}
		return { operational, degraded, down, unknown, total: $serviceStatuses.length };
	});
</script>

<div class="mx-auto max-w-7xl">
	<!-- Header -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<Activity class="h-6 w-6 text-accent-primary" />
			<div>
				<h1 class="text-2xl font-bold text-white">Service Status</h1>
				{#if $statusLastChecked}
					<p class="mt-0.5 text-sm text-slate-500">
						Last checked: {relativeTime($statusLastChecked)}
					</p>
				{/if}
			</div>
		</div>
		<button
			class="flex items-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
			onclick={() => fetchServiceStatuses()}
			disabled={$statusLoading}
		>
			<RefreshCw class="h-4 w-4 {$statusLoading ? 'animate-spin' : ''}" />
			Refresh
		</button>
	</div>

	<!-- Summary bar -->
	{#if summary.total > 0}
		<div class="mb-6 flex flex-wrap gap-3">
			<div class="flex items-center gap-2 bg-slate-900 px-3 py-1.5">
				<span class="h-2.5 w-2.5 bg-emerald-500"></span>
				<span class="text-sm text-slate-300">{summary.operational} Operational</span>
			</div>
			{#if summary.degraded > 0}
				<div class="flex items-center gap-2 bg-slate-900 px-3 py-1.5">
					<span class="h-2.5 w-2.5 bg-amber-500"></span>
					<span class="text-sm text-slate-300">{summary.degraded} Degraded</span>
				</div>
			{/if}
			{#if summary.down > 0}
				<div class="flex items-center gap-2 bg-slate-900 px-3 py-1.5">
					<span class="h-2.5 w-2.5 bg-red-500"></span>
					<span class="text-sm text-slate-300">{summary.down} Down</span>
				</div>
			{/if}
			{#if summary.unknown > 0}
				<div class="flex items-center gap-2 bg-slate-900 px-3 py-1.5">
					<span class="h-2.5 w-2.5 bg-slate-600"></span>
					<span class="text-sm text-slate-300">{summary.unknown} Unknown</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Service list -->
	<div class="flex flex-col gap-1">
		{#each $serviceStatuses as service (service.id)}
			{@const effective = worstStatus(service)}
			<div class="border border-slate-800 bg-slate-900">
				<!-- Service row -->
				<div class="flex items-center gap-3 px-3 py-1.5">
					<span class="h-1.5 w-1.5 shrink-0 {getStatusColor(effective)}"></span>
					<span class="truncate text-sm font-semibold text-white">{service.name}</span>
					<div class="ml-auto flex shrink-0 items-center gap-3 text-xs text-slate-400">
						{#if service.responseTime}
							<span class="text-slate-500">{service.responseTime}ms</span>
						{/if}
						{#if service.url}
							<a
								href={service.url}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center text-slate-500 transition-colors hover:text-accent-primary"
								title="Open status page"
							>
								<ExternalLink class="h-3 w-3" />
							</a>
						{/if}
						{#if service.children && service.children.length > 0}
							<button
								type="button"
								onclick={() => toggleCard(service.id)}
								class="flex items-center gap-1 text-slate-500 hover:text-slate-300"
							>
								{#if expandedCards.has(service.id)}
									<ChevronDown class="h-3 w-3" />
								{:else}
									<ChevronRight class="h-3 w-3" />
								{/if}
								{service.children.length}
							</button>
						{/if}
						<span class="px-1.5 py-0.5 text-[10px] font-medium {getStatusBadgeClass(effective)}">
							{getStatusText(effective)}
						</span>
					</div>
				</div>

				<!-- Children -->
				{#if service.children && service.children.length > 0 && expandedCards.has(service.id)}
					<div class="border-t border-slate-800 px-3 py-1">
						{#each service.children as child (child.id)}
							<div class="flex items-center justify-between py-0.5">
								<div class="flex items-center gap-2">
									<span class="h-1.5 w-1.5 {getStatusColor(child.status)}"></span>
									<span class="text-xs text-slate-400">{child.name}</span>
								</div>
								<span class="text-[10px] text-slate-600">{getStatusText(child.status)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<!-- Loading state -->
			{#each Array(6) as _}
				<div class="animate-pulse border border-slate-800 bg-slate-900 px-3 py-1.5">
					<div class="flex items-center gap-3">
						<div class="h-1.5 w-1.5 bg-slate-700"></div>
						<div class="h-3 w-24 bg-slate-700"></div>
					</div>
				</div>
			{/each}
		{/each}
	</div>
</div>

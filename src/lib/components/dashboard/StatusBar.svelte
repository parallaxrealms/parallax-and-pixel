<script lang="ts">
	import { Activity } from 'lucide-svelte';
	import { selectedTab } from '@parallaxrealms/pxp-utils/stores-core';
	import { serviceStatuses, statusLastChecked, startStatusPolling, stopStatusPolling } from '$lib/stores/serviceStatus';
	import type { ServiceHealth } from '$lib/types/service-status';

	interface Props {
		isOpen: boolean;
		isMobile: boolean;
	}

	let { isOpen, isMobile }: Props = $props();

	// Start polling on mount, stop on destroy
	$effect(() => {
		startStatusPolling(60000);
		return () => stopStatusPolling();
	});

	function getStatusColor(status: ServiceHealth): string {
		switch (status) {
			case 'operational':
				return 'bg-emerald-500';
			case 'degraded':
				return 'bg-yellow-500';
			case 'down':
				return 'bg-red-500';
			default:
				return 'bg-slate-600';
		}
	}

	function worstStatus(service: { status: ServiceHealth; children?: { status: ServiceHealth }[] }): ServiceHealth {
		if (!service.children?.length) return service.status;
		const statuses = [service.status, ...service.children.map((c) => c.status)];
		if (statuses.includes('down')) return 'down';
		if (statuses.includes('degraded')) return 'degraded';
		if (statuses.includes('unknown')) return 'unknown';
		return 'operational';
	}

	let lastTime = $derived(() => {
		if (!$statusLastChecked) return '';
		const d = new Date($statusLastChecked);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	});
</script>

<!-- Full-width bar sits BEHIND the sidebar (z-30 < sidebar z-50); content is
	offset by the sidebar width so every service is visible, not hidden under it.
	Padding-left is kept in sync with the sidebar widths: 240px expanded / 64px
	collapsed / 0 on mobile. -->
<div
	class="fixed bottom-0 left-0 right-0 z-30 hidden h-7 items-center border-t border-slate-800 bg-slate-950 transition-all duration-300 md:flex"
	style="padding-left: {isMobile ? '0px' : isOpen ? '240px' : '64px'}"
>
	<!-- Left: clickable icon + label -->
	<button
		class="flex h-full shrink-0 items-center gap-1 border-r border-slate-800 px-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-200"
		onclick={() => selectedTab.set('status')}
		title="Open Service Status"
	>
		<Activity class="h-3 w-3" />
		{#if !isMobile}
			<span class="text-[10px] font-medium">Service Status:</span>
		{/if}
	</button>

	<!-- Center: scrollable status indicators -->
	<div class="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-2" style="scrollbar-width: none;">
		{#each $serviceStatuses as service (service.id)}
			{@const effective = worstStatus(service)}
			<div class="flex shrink-0 items-center gap-1" title="{service.name}: {effective}">
				<span class="h-2 w-2 shrink-0 {getStatusColor(effective)}"></span>
				{#if !isMobile}
					<span class="text-[10px] text-slate-500">{service.name}</span>
				{/if}
			</div>
		{/each}

		{#if $serviceStatuses.length === 0}
			<span class="text-[11px] text-slate-600">Checking services...</span>
		{/if}
	</div>

	<!-- Right: last checked time -->
	{#if $statusLastChecked}
		<div class="shrink-0 border-l border-slate-800 px-2.5">
			<span class="text-[10px] text-slate-600">Last: {lastTime()}</span>
		</div>
	{/if}
</div>

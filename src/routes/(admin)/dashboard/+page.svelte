<script lang="ts">
	import { PUBLIC_SITE_ID } from '$env/static/public';
	import { selectedTab } from '@parallaxrealms/pxp-utils/stores-core';
	import { dashboardReady } from '@parallaxrealms/pxp-utils/stores-ecom';
	import HomeTab from '$lib/components/dashboardTabs/HomeTab.svelte';
	import WebsiteTab from '$lib/components/dashboardTabs/WebsiteTab.svelte';
	import MediaLibraryTab from '$lib/components/dashboardTabs/MediaLibraryTab.svelte';
	import SocialTab from '$lib/components/dashboardTabs/SocialTab.svelte';
	import TelemetryTab from '$lib/components/dashboardTabs/TelemetryTab.svelte';
	import AuditTab from '$lib/components/dashboardTabs/AuditTab.svelte';
	import MockupsTab from '$lib/components/dashboardTabs/MockupsTab.svelte';
	import ToolsTab from '$lib/components/dashboardTabs/ToolsTab.svelte';
	import DaedalusTab from '$lib/components/dashboardTabs/DaedalusTab.svelte';
	import TasksTab from '$lib/components/dashboardTabs/TasksTab.svelte';
	import CalendarTab from '$lib/components/dashboardTabs/CalendarTab.svelte';
	import NotesTab from '$lib/components/dashboardTabs/NotesTab.svelte';
	import FinancesTab from '$lib/components/dashboardTabs/FinancesTab.svelte';
	import BifrostTab from '$lib/components/dashboardTabs/BifrostTab.svelte';
	import ServiceStatusTab from '$lib/components/dashboardTabs/ServiceStatusTab.svelte';
	import EmailTab from '$lib/components/dashboardTabs/EmailTab.svelte';
	import SettingsTab from '$lib/components/dashboardTabs/SettingsTab.svelte';
	import UsersTab from '$lib/components/dashboardTabs/UsersTab.svelte';

	let { data } = $props();
	let supabase = $derived(data.supabase);
	let siteId = PUBLIC_SITE_ID || 'unknown';
</script>

<section
	class="relative {$selectedTab === 'theme-editor' || $selectedTab === 'sidebar-config'
		? 'h-screen'
		: 'min-h-screen'} overflow-hidden bg-slate-950"
>
	<div
		class="relative z-10 mx-auto w-full {$selectedTab === 'theme-editor' ||
		$selectedTab === 'sidebar-config'
			? 'p-0'
			: 'px-6 py-12'}"
	>
		{#if !$dashboardReady}
			<div class="flex items-center justify-center py-20">
				<div class="h-8 w-8 animate-spin border-2 border-slate-700 border-t-accent-primary"></div>
			</div>
		{:else}
			{#if $selectedTab === 'home'}
				<div>
					<HomeTab {supabase} />
				</div>
			{:else if $selectedTab === 'website'}
				<div>
					<WebsiteTab {supabase} />
				</div>
			{:else if $selectedTab === 'media'}
				<div>
					<MediaLibraryTab {supabase} />
				</div>
			{:else if $selectedTab === 'social'}
				<div>
					<SocialTab {supabase} {siteId} />
				</div>
			{:else if $selectedTab === 'telemetry'}
				<div>
					<TelemetryTab {supabase} />
				</div>
			{:else if $selectedTab === 'audit'}
				<div>
					<AuditTab {supabase} />
				</div>
			{:else if $selectedTab === 'mockups'}
				<div>
					<MockupsTab {supabase} />
				</div>
			{:else if $selectedTab === 'tools'}
				<div>
					<ToolsTab {supabase} />
				</div>
			{:else if $selectedTab === 'daedalus'}
				<div>
					<DaedalusTab {supabase} />
				</div>
			{:else if $selectedTab === 'tasks'}
				<div>
					<TasksTab {supabase} />
				</div>
			{:else if $selectedTab === 'calendar'}
				<div>
					<CalendarTab {supabase} />
				</div>
			{:else if $selectedTab === 'notes'}
				<div>
					<NotesTab {supabase} />
				</div>
			{:else if $selectedTab === 'finances'}
				<div>
					<FinancesTab {supabase} />
				</div>
			{:else if $selectedTab === 'bifrost'}
				<div>
					<BifrostTab {supabase} />
				</div>
			{:else if $selectedTab === 'status'}
				<div>
					<ServiceStatusTab {supabase} />
				</div>
			{:else if $selectedTab === 'email'}
				<div>
					<EmailTab {supabase} />
				</div>
			{:else if $selectedTab === 'settings'}
				<div>
					<SettingsTab {supabase} />
				</div>
			{:else if $selectedTab === 'users'}
				<div>
					<UsersTab {supabase} />
				</div>
			{/if}
		{/if}
	</div>
</section>

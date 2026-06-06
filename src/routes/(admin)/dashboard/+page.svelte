<script lang="ts">
	import { PUBLIC_SITE_ID } from '$env/static/public';
	import { selectedTab } from '@parallaxrealms/stores-core';
	import { dashboardReady } from '@parallaxrealms/stores-ecom';
	import HomeTab from '$lib/components/dashboardTabs/HomeTab.svelte';
	import WebsiteTab from '$lib/components/dashboardTabs/WebsiteTab.svelte';
	import MediaLibraryTab from '$lib/components/dashboardTabs/MediaLibraryTab.svelte';
	import SocialTab from '$lib/components/dashboardTabs/SocialTab.svelte';

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
			{/if}
		{/if}
	</div>
</section>

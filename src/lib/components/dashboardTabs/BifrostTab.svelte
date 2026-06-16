<script lang="ts">
	/**
	 * Admin Bifrost tab — the realm-agent console.
	 *
	 * A sharp segmented sub-nav switches between the chat client and four
	 * read/configure sub-views (Overview, Memory, Agents, Settings). Chat connects
	 * DIRECTLY to the Bifrost daemon (WebSocket + REST), authed with the user's
	 * Supabase JWT; the other views read public Supabase tables and the daemon's
	 * REST surface. When PUBLIC_BIFROST_DAEMON_URL is unset/'mock', each view shows
	 * its own graceful "not configured" state instead of attempting a connection.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { MessageSquare, LayoutDashboard, Brain, Users, SlidersHorizontal } from 'lucide-svelte';
	import BifrostChat from './bifrost/BifrostChat.svelte';
	import BifrostOverview from './bifrost/BifrostOverview.svelte';
	import BifrostMemory from './bifrost/BifrostMemory.svelte';
	import BifrostAgents from './bifrost/BifrostAgents.svelte';
	import BifrostSettings from './bifrost/BifrostSettings.svelte';

	let { supabase }: { supabase: SupabaseClient } = $props();

	type View = 'chat' | 'overview' | 'memory' | 'agents' | 'settings';

	const TABS: { key: View; label: string; icon: typeof MessageSquare }[] = [
		{ key: 'chat', label: 'Chat', icon: MessageSquare },
		{ key: 'overview', label: 'Overview', icon: LayoutDashboard },
		{ key: 'memory', label: 'Memory', icon: Brain },
		{ key: 'agents', label: 'Agents', icon: Users },
		{ key: 'settings', label: 'Settings', icon: SlidersHorizontal }
	];

	let view = $state<View>('chat');

	// BifrostOverview links jump between sub-views; map its narrower view union onto ours.
	function navigate(target: 'chat' | 'memory' | 'agents' | 'settings') {
		view = target;
	}
</script>

<div class="flex h-[calc(100vh-8rem)] flex-col">
	<!-- Segmented sub-nav: sharp, no rounded, accent on active. Scrolls on mobile. -->
	<nav class="flex shrink-0 overflow-x-auto border-b border-slate-800">
		{#each TABS as tab (tab.key)}
			{@const Icon = tab.icon}
			<button
				onclick={() => (view = tab.key)}
				class="flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition {view ===
				tab.key
					? 'border-accent-primary text-accent-primary'
					: 'border-transparent text-slate-400 hover:text-slate-200'}"
				aria-current={view === tab.key ? 'page' : undefined}
			>
				<Icon class="h-4 w-4" />
				<span>{tab.label}</span>
			</button>
		{/each}
	</nav>

	<!-- Content -->
	<div class="min-h-0 flex-1">
		{#if view === 'chat'}
			<div class="h-full">
				<BifrostChat {supabase} />
			</div>
		{:else}
			<div class="h-full overflow-y-auto px-1 py-6 sm:px-2">
				{#if view === 'overview'}
					<BifrostOverview {supabase} onNavigate={navigate} />
				{:else if view === 'memory'}
					<BifrostMemory {supabase} />
				{:else if view === 'agents'}
					<BifrostAgents {supabase} />
				{:else if view === 'settings'}
					<BifrostSettings {supabase} />
				{/if}
			</div>
		{/if}
	</div>
</div>

<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { X, Wrench, Search, BookOpen, Globe, Link2, Brain, Inbox, Flag, AlertTriangle, Loader2 } from 'lucide-svelte';
	import { env } from '$env/dynamic/public';
	import { DaemonRestClient, type AgentToolInfo } from '$lib/data/bifrost/daemon';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		supabase: SupabaseClient;
		agent: string;
		agentName: string;
		onClose: () => void;
	}

	let { supabase, agent, agentName, onClose }: Props = $props();

	const daemonUrl = env.PUBLIC_BIFROST_DAEMON_URL ?? '';
	const daemonConfigured = daemonUrl.trim().length > 0 && daemonUrl !== 'mock';
	// svelte-ignore state_referenced_locally
	const rest = daemonConfigured ? new DaemonRestClient(daemonUrl, supabase) : null;

	let tools = $state<AgentToolInfo[]>([]);
	let loading = $state(daemonConfigured);
	let error = $state<string | null>(null);

	$effect(() => {
		if (rest) void load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			tools = await rest!.listAgentTools(agent);
		} catch {
			error = "Couldn't load the tool list.";
		} finally {
			loading = false;
		}
	}

	// Map known tool names to an icon; everything else falls back to a wrench.
	function iconFor(name: string) {
		switch (name) {
			case 'search_parallaxbrain': return Search;
			case 'read_parallaxbrain': return BookOpen;
			case 'web_search': return Globe;
			case 'scrape_url': return Link2;
			case 'memory_recall':
			case 'memory_save': return Brain;
			case 'propose_drop': return Inbox;
			case 'flag_gap': return Flag;
			default: return Wrench;
		}
	}

	function riskClass(risk: string): string {
		if (risk === 'high') return 'bg-red-500/15 text-red-400';
		if (risk === 'medium') return 'bg-amber-500/15 text-amber-400';
		return 'bg-slate-700/60 text-slate-400';
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
	onclick={onClose}
	transition:fade={{ duration: 120 }}
>
	<!-- Panel -->
	<div
		class="flex max-h-[90vh] w-full max-w-lg flex-col border border-slate-700 bg-slate-900 shadow-xl"
		onclick={(e) => e.stopPropagation()}
		transition:scale={{ duration: 150, start: 0.97 }}
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="{agentName}'s tools"
	>
		<!-- Header -->
		<div class="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
			<div class="flex items-center gap-2">
				<Wrench class="h-4 w-4 text-accent-primary" />
				<h2 class="text-sm font-semibold text-white">{agentName}'s tools</h2>
			</div>
			<button onclick={onClose} class="p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200" aria-label="Close">
				<X class="h-4 w-4" />
			</button>
		</div>

		<!-- Body -->
		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
			<p class="mb-3 text-xs leading-relaxed text-slate-500">
				{agentName} reaches for these on its own when your question calls for it — you don't invoke them directly. Just ask naturally; you'll see a tool card in the reply when one runs.
			</p>

			{#if !daemonConfigured}
				<div class="flex flex-col items-center gap-2 py-8 text-center">
					<AlertTriangle class="h-8 w-8 text-slate-700" />
					<p class="text-sm text-slate-400">Tools are only available when the daemon is configured.</p>
				</div>
			{:else if loading}
				<div class="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 class="h-4 w-4 animate-spin" /> Loading tools…</div>
			{:else if error}
				<div class="flex flex-col items-center gap-2 py-8 text-center">
					<AlertTriangle class="h-8 w-8 text-slate-700" />
					<p class="text-sm text-slate-400">{error}</p>
					<button onclick={() => load()} class="mt-1 border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-600">Retry</button>
				</div>
			{:else if tools.length === 0}
				<div class="flex flex-col items-center gap-2 py-8 text-center">
					<Brain class="h-8 w-8 text-slate-700" />
					<p class="text-sm text-slate-400">{agentName} answers from context — no tools wired yet.</p>
				</div>
			{:else}
				<ul class="space-y-2">
					{#each tools as tool (tool.name)}
						{@const ToolIcon = iconFor(tool.name)}
						<li class="border border-slate-800 bg-slate-900/60 p-3">
							<div class="flex items-center gap-2">
								<ToolIcon class="h-4 w-4 flex-shrink-0 text-accent-primary" />
								<span class="text-sm font-medium text-slate-200">{tool.label}</span>
								<span class="font-mono text-[10px] text-slate-600">{tool.name}</span>
								{#if tool.risk !== 'low'}
									<span class="ml-auto px-1.5 py-0.5 text-[9px] uppercase tracking-wide {riskClass(tool.risk)}">{tool.risk}</span>
								{/if}
							</div>
							<p class="mt-1.5 text-xs leading-relaxed text-slate-500">{tool.description}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Footer -->
		<div class="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-600">
			Tip: type <span class="font-mono text-slate-400">/help</span> in the chat to reopen this.
		</div>
	</div>
</div>

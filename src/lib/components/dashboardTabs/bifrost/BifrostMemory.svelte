<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { Brain, Search, AlertTriangle, Star, Loader2 } from 'lucide-svelte';
	import { env } from '$env/dynamic/public';
	import { DaemonRestClient, type DaemonMemory } from '$lib/data/bifrost/daemon';
	import { agentMeta } from '$lib/config/bifrostAgents';

	interface Props {
		supabase: SupabaseClient;
	}

	let { supabase }: Props = $props();

	const daemonUrl = env.PUBLIC_BIFROST_DAEMON_URL ?? '';
	// svelte-ignore state_referenced_locally
	const rest = new DaemonRestClient(daemonUrl, supabase);
	let daemonConfigured = $derived(!!daemonUrl && daemonUrl !== 'mock');

	let memories = $state<DaemonMemory[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');

	$effect(() => {
		if (daemonConfigured) void load();
		else loading = false;
	});

	async function load() {
		loading = true;
		error = null;
		try {
			memories = await rest.listMemories();
		} catch {
			error = 'Could not reach the daemon to load memories.';
			memories = [];
		} finally {
			loading = false;
		}
	}

	// Client-side filter: the daemon also filters server-side, but filtering the
	// already-loaded set keeps the search instant and avoids a round-trip per keystroke.
	let filtered = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return memories;
		const terms = q.split(/\s+/).filter(Boolean);
		return memories.filter((m) => {
			const hay = `${m.content} ${m.category}`.toLowerCase();
			return terms.every((t) => hay.includes(t));
		});
	});

	function agentLabel(key: string | null): string {
		return key ? agentMeta(key).name : 'Shared';
	}

	function relativeTime(iso: string): string {
		const then = new Date(iso).getTime();
		if (Number.isNaN(then)) return '';
		const diff = Date.now() - then;
		const min = Math.floor(diff / 60000);
		if (min < 1) return 'just now';
		if (min < 60) return `${min}m ago`;
		const hr = Math.floor(min / 60);
		if (hr < 24) return `${hr}h ago`;
		const day = Math.floor(hr / 24);
		if (day < 30) return `${day}d ago`;
		const mo = Math.floor(day / 30);
		return `${mo}mo ago`;
	}
</script>

<section class="mx-auto max-w-6xl">
	<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<header class="flex items-center gap-3">
			<Brain class="h-6 w-6 text-accent-primary" />
			<div>
				<h1 class="text-2xl font-bold text-white">Memory</h1>
				<p class="mt-0.5 text-sm text-slate-400">
					Durable facts your agents have kept across conversations.
				</p>
			</div>
		</header>
		<div class="relative w-full sm:w-64">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search memories…"
				class="w-full border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
			/>
		</div>
	</div>

	{#if !daemonConfigured}
		<div class="border border-amber-500/40 bg-amber-500/10 px-4 py-12 text-center">
			<AlertTriangle class="mx-auto mb-3 h-8 w-8 text-amber-400" />
			<p class="mb-1 text-sm font-medium text-amber-300">The Bifrost daemon isn't configured.</p>
			<p class="text-xs text-slate-400">
				<span class="font-mono text-slate-300">PUBLIC_BIFROST_DAEMON_URL</span> is unset — memories can't
				be reached.
			</p>
		</div>
	{:else if loading}
		<div class="flex items-center justify-center py-16">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else if error}
		<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center">
			<AlertTriangle class="mx-auto mb-3 h-8 w-8 text-slate-600" />
			<p class="text-sm text-slate-400">{error}</p>
			<button
				onclick={() => load()}
				class="mt-3 inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
			>
				Retry
			</button>
		</div>
	{:else if memories.length === 0}
		<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center">
			<Brain class="mx-auto mb-3 h-12 w-12 text-slate-700" />
			<h2 class="mb-2 text-lg font-medium text-slate-400">No memories yet</h2>
			<p class="mx-auto max-w-md text-sm text-slate-500">
				Mimir saves durable facts — a preference, a constraint, a decision and why — as you talk.
				They'll appear here for browsing.
			</p>
		</div>
	{:else if filtered.length === 0}
		<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500">
			No memories match “{searchQuery}”.
		</div>
	{:else}
		<p class="mb-3 text-xs text-slate-500">
			{filtered.length}{filtered.length !== memories.length ? ` of ${memories.length}` : ''}
			{filtered.length === 1 ? 'memory' : 'memories'}
		</p>
		<ul class="grid grid-cols-1 gap-3 md:grid-cols-2">
			{#each filtered as m (m.id)}
				<li class="flex flex-col gap-2 border border-slate-800 bg-slate-900/50 p-4">
					<p class="text-sm leading-relaxed text-slate-200">{m.content}</p>
					<div class="mt-auto flex flex-wrap items-center gap-2 text-[10px]">
						<span class="bg-accent-primary/15 px-1.5 py-0.5 uppercase tracking-wide text-accent-primary">
							{agentLabel(m.agent)}
						</span>
						<span class="bg-slate-800 px-1.5 py-0.5 text-slate-400">{m.category}</span>
						<span class="flex items-center gap-0.5 text-slate-500" title="importance {m.importance}/10">
							<Star class="h-3 w-3" fill="currentColor" />{m.importance}
						</span>
						<span class="ml-auto text-slate-500">{relativeTime(m.updated_at)}</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

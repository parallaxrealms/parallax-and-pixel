<script lang="ts">
	// Compact card showing one tool the agent ran this turn — e.g. "Searched the
	// well: bifrost daemon". Used both live (during streaming, status reflects
	// running/done) and on finished assistant messages (status 'done').
	import { Search, Globe, FileText, Loader2, Check, Wrench, Brain, Bookmark } from 'lucide-svelte';

	interface Props {
		name: string;
		params: Record<string, unknown>;
		status?: 'running' | 'done';
		/** Epoch ms the call started (live cards). Drives the ticking elapsed clock. */
		startedAt?: number;
		/** Epoch ms the result landed (live cards). Freezes the clock when present. */
		endedAt?: number;
		/** Pre-computed duration for reloaded messages, where startedAt isn't available. */
		durationMs?: number;
	}
	let { name, params, status = 'done', startedAt, endedAt, durationMs }: Props = $props();

	const META: Record<string, { label: string; icon: typeof Search; arg: string }> = {
		search_parallaxbrain: { label: 'Searched the well', icon: Search, arg: 'query' },
		web_search: { label: 'Searched the web', icon: Globe, arg: 'query' },
		scrape_url: { label: 'Read page', icon: FileText, arg: 'url' },
		memory_recall: { label: 'Recalled memory', icon: Brain, arg: 'query' },
		memory_save: { label: 'Remembered', icon: Bookmark, arg: 'content' }
	};
	const meta = $derived(META[name] ?? { label: name, icon: Wrench, arg: 'query' });
	const Icon = $derived(meta.icon);
	const detail = $derived(String((params as Record<string, unknown>)?.[meta.arg] ?? ''));

	// Live clock: tick only while running, so the elapsed label climbs and the
	// user can see the agent is still working ("executing for 4s…"). A wall clock
	// is a genuine time source — not derivable — so an $effect driving setInterval
	// is the right tool; it's torn down the moment status flips to done or the
	// card unmounts. `now` starts at 0 and the effect stamps the real time on its
	// first synchronous run, so it never captures a stale initial `startedAt`.
	let now = $state(0);
	$effect(() => {
		if (status !== 'running' || !startedAt) return;
		now = Date.now();
		const id = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(id);
	});

	// ms elapsed for this call: a frozen duration on reload, the live tick while
	// running, or the start→end span once finished. Null when we have no timing.
	const elapsedMs = $derived(
		durationMs ??
			(startedAt != null
				? (status === 'running' ? now : (endedAt ?? now)) - startedAt
				: null)
	);
	const elapsedLabel = $derived(
		elapsedMs == null
			? ''
			: elapsedMs < 1000
				? `${Math.max(0, Math.round(elapsedMs))}ms`
				: `${(elapsedMs / 1000).toFixed(1)}s`
	);
</script>

<div
	class="my-1 flex items-center gap-2 border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-400"
	title="{meta.label}{detail ? `: ${detail}` : ''}"
>
	{#if status === 'running'}
		<Loader2 class="h-3 w-3 shrink-0 animate-spin text-accent-primary" />
	{:else}
		<Icon class="h-3 w-3 shrink-0 text-slate-500" />
	{/if}
	<span class="shrink-0 text-slate-300">{meta.label}</span>
	{#if detail}
		<span class="min-w-0 truncate font-mono text-slate-500">{detail}</span>
	{/if}
	{#if status === 'running'}
		{#if elapsedLabel}
			<span class="ml-auto shrink-0 font-mono tabular-nums text-slate-500" aria-live="polite"
				>{elapsedLabel}</span
			>
		{/if}
	{:else}
		{#if elapsedLabel}
			<span class="ml-auto shrink-0 font-mono tabular-nums text-slate-600">{elapsedLabel}</span>
			<Check class="h-3 w-3 shrink-0 text-emerald-400/80" />
		{:else}
			<Check class="ml-auto h-3 w-3 shrink-0 text-emerald-400/80" />
		{/if}
	{/if}
</div>

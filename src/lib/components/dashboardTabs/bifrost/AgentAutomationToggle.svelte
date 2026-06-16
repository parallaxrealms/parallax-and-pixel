<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import { toast } from 'svelte-sonner';
	import { Zap, ZapOff } from 'lucide-svelte';
	import { DaemonRestClient } from '$lib/data/bifrost/daemon/rest';
	import type { AgentAutomation } from '$lib/data/bifrost/daemon/rest';

	// A labeled switch for ONE automation key. Reads the runtime master switch from
	// its `automation` prop (the row the parent fetched via getAgentAutomation) and
	// writes flips back through the unified /api/agents/automation endpoint — the
	// single source of truth every toggle shares. Optimistic flip, toast + revert on
	// error, disabled while saving. Off = the cron tick is skipped (zero tokens).
	let {
		supabase,
		automation,
		onToggled,
		compact = false
	} = $props<{
		supabase: SupabaseClient;
		automation: AgentAutomation;
		/** Fired after a successful flip, with the new value (lets the parent re-sync). */
		onToggled?: (enabled: boolean) => void;
		/** Header-corner layout: switch + tiny label/description, no full-card chrome. */
		compact?: boolean;
	}>();

	const daemonUrl = env.PUBLIC_BIFROST_DAEMON_URL ?? '';
	const daemonConfigured = !!daemonUrl && daemonUrl !== 'mock';
	const makeRest = () => new DaemonRestClient(daemonUrl, supabase);

	// Writable $derived: mirrors the prop's enabled flag, but the optimistic flip
	// can override it locally; it resyncs automatically if the parent re-fetches
	// and passes a fresh row.
	let enabled = $derived(automation.enabled);
	let saving = $state(false);

	async function toggle() {
		if (saving || !browser || !daemonConfigured) return;
		const next = !enabled;
		saving = true;
		enabled = next; // optimistic
		try {
			await makeRest().setAgentAutomation(automation.key, next);
			toast.success(
				next
					? `${automation.label} on — runs on schedule.`
					: `${automation.label} off — skips its scheduled run. Saves tokens.`
			);
			onToggled?.(next);
		} catch (e) {
			enabled = !next; // revert
			console.error('[AgentAutomationToggle] toggle failed', e);
			toast.error(`Could not change ${automation.label}`);
		} finally {
			saving = false;
		}
	}
</script>

{#snippet switchButton()}
	<button
		type="button"
		role="switch"
		aria-checked={enabled}
		aria-label="Toggle {automation.label}"
		onclick={toggle}
		disabled={saving || !daemonConfigured}
		class="relative inline-flex h-5 w-9 shrink-0 items-center border transition-colors disabled:opacity-50 {enabled
			? 'border-accent-primary bg-accent-primary/30'
			: 'border-slate-700 bg-slate-800'}"
	>
		<span
			class="inline-block h-3.5 w-3.5 transition-transform {enabled
				? 'translate-x-[18px] bg-accent-primary'
				: 'translate-x-0.5 bg-slate-500'}"
		></span>
	</button>
{/snippet}

{#if compact}
	<!-- Header-corner variant: tiny label + one-line state, switch on the right. -->
	<div class="flex shrink-0 items-center gap-2">
		<div class="text-right leading-tight">
			<div class="flex items-center justify-end gap-1 text-[11px] font-medium text-slate-300">
				{#if enabled}
					<Zap class="h-3 w-3 shrink-0 text-accent-primary" />
				{:else}
					<ZapOff class="h-3 w-3 shrink-0 text-slate-500" />
				{/if}
				<span class="truncate">{automation.label}</span>
			</div>
			<div class="text-[9px] {enabled && !automation.cron ? 'text-amber-400/80' : 'text-slate-500'}">
				{#if enabled}
					{automation.cron ? 'On · on schedule' : 'On · no schedule set'}
				{:else}
					Off · saves tokens
				{/if}
			</div>
		</div>
		{@render switchButton()}
	</div>
{:else}
	<div
		class="flex items-center justify-between gap-3 border border-slate-800 border-l-2 border-l-accent-primary bg-slate-900/50 px-3 py-2.5"
	>
		<div class="flex items-start gap-2.5">
			{#if enabled}
				<Zap class="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
			{:else}
				<ZapOff class="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
			{/if}
			<div>
				<div class="text-sm font-medium tracking-wide text-white">
					{automation.label}
					<span class="ml-1.5 text-[10px] uppercase tracking-wider text-slate-500">{automation.agent}</span>
				</div>
				<p class="text-[11px] leading-relaxed text-slate-500">
					{#if enabled}
						On — runs on its schedule{automation.cron
							? ` (${automation.cron}${automation.timezone ? `, ${automation.timezone}` : ''})`
							: ''}.
					{:else}
						Off — skips its scheduled run. <span class="text-slate-400">Saves tokens when off.</span>
					{/if}
					{#if enabled && !automation.cron}
						<span class="text-amber-400/80"> No schedule set on the daemon — nothing will fire.</span>
					{/if}
				</p>
			</div>
		</div>
		{@render switchButton()}
	</div>
{/if}

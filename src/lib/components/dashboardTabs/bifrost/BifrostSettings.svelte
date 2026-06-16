<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { Key, Cpu, Activity, Gauge, BarChart3, Save, Check, SlidersHorizontal, Bot, Globe, Sparkles, Palette, Bell, Loader2 } from 'lucide-svelte';
	import {
		loadBudgetConfig,
		saveBudgetConfig,
		type BudgetConfig
	} from '$lib/data/bifrost/chat/budget';
	import { formatTokenCount } from '$lib/data/bifrost/token-utils';
	import { env } from '$env/dynamic/public';
	import { DaemonRestClient } from '$lib/data/bifrost/daemon';

	interface Props {
		supabase: SupabaseClient;
	}

	let { supabase }: Props = $props();

	// Daemon mode reflects the real env config. When PUBLIC_BIFROST_DAEMON_URL is
	// unset or 'mock', BifrostChat runs the mock provider; otherwise it connects to
	// the daemon (live connection state is shown on the Overview tab).
	const daemonUrl = env.PUBLIC_BIFROST_DAEMON_URL ?? '';
	const daemonConfigured = !!daemonUrl && daemonUrl !== 'mock';

	// Budget config state
	let config = $state<BudgetConfig | null>(null);
	let dailyLimit = $state(100000);
	let monthlyLimit = $state(2000000);
	let perConversationLimit = $state(50000);
	let warningThreshold = $state(80);
	let saving = $state(false);
	let saved = $state(false);

	// Provider key availability — derived from the daemon's model catalog (a usable
	// key exists for a provider iff one of its models reports `available`).
	let providers = $state<{ name: string; available: boolean }[]>([]);
	let providersLoaded = $state(false);

	// Usage analytics state
	let todayUsage = $state(0);
	let weekUsage = $state(0);
	let monthUsage = $state(0);
	let allTimeUsage = $state(0);
	let topConversations = $state<Array<{ title: string; tokens: number }>>([]);
	let avgPerConversation = $state(0);

	$effect(() => {
		loadConfig();
		loadAnalytics();
		loadProviders();
	});

	function cap(s: string): string {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	async function loadProviders() {
		if (!daemonConfigured) {
			providersLoaded = true;
			return;
		}
		try {
			const rest = new DaemonRestClient(daemonUrl, supabase);
			const { models } = await rest.listModels();
			const map = new Map<string, boolean>();
			for (const m of models) {
				if (!m.provider) continue;
				map.set(m.provider, (map.get(m.provider) ?? false) || m.available !== false);
			}
			providers = [...map.entries()].map(([name, available]) => ({ name: cap(name), available }));
		} catch (err) {
			console.error('Failed to load providers:', err);
		} finally {
			providersLoaded = true;
		}
	}

	async function loadConfig() {
		try {
			config = await loadBudgetConfig(supabase);
			dailyLimit = config.daily_limit;
			monthlyLimit = config.monthly_limit;
			perConversationLimit = config.per_conversation_limit;
			warningThreshold = Math.round(config.warning_threshold * 100);
		} catch (err) {
			console.error('Failed to load budget config:', err);
		}
	}

	async function handleSave() {
		saving = true;
		saved = false;
		try {
			await saveBudgetConfig(supabase, {
				daily_limit: dailyLimit,
				monthly_limit: monthlyLimit,
				per_conversation_limit: perConversationLimit,
				warning_threshold: warningThreshold / 100
			});
			saved = true;
			setTimeout(() => (saved = false), 2000);
		} catch (err) {
			console.error('Failed to save budget config:', err);
		} finally {
			saving = false;
		}
	}

	async function loadAnalytics() {
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) return;

			const now = new Date();

			// Today
			const todayStart = new Date(now);
			todayStart.setUTCHours(0, 0, 0, 0);

			// Week start (Monday)
			const weekStart = new Date(now);
			const dayOfWeek = weekStart.getUTCDay();
			const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
			weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);
			weekStart.setUTCHours(0, 0, 0, 0);

			// Month start
			const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

			// Fetch billable (paid) usage only — $0 OpenRouter :free exchanges are
			// flagged billable=false and excluded so the panel matches budget accounting.
			const { data: allUsage } = await supabase
				.from('bifrost_token_usage')
				.select('input_tokens, output_tokens, conversation_id, created_at')
				.eq('user_id', user.id)
				.eq('billable', true)
				.order('created_at', { ascending: false });

			if (!allUsage) return;

			const sumTokens = (rows: typeof allUsage) =>
				rows.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);

			allTimeUsage = sumTokens(allUsage);
			monthUsage = sumTokens(allUsage.filter((r) => new Date(r.created_at) >= monthStart));
			weekUsage = sumTokens(allUsage.filter((r) => new Date(r.created_at) >= weekStart));
			todayUsage = sumTokens(allUsage.filter((r) => new Date(r.created_at) >= todayStart));

			// Top conversations by usage
			const convMap = new Map<string, number>();
			for (const row of allUsage) {
				if (!row.conversation_id) continue;
				const total = (row.input_tokens || 0) + (row.output_tokens || 0);
				convMap.set(row.conversation_id, (convMap.get(row.conversation_id) || 0) + total);
			}

			// Resolve conversation titles for the top 3. In daemon mode the
			// conversations live in the daemon's SQLite, so we ask the daemon for titles.
			const sorted = [...convMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
			if (sorted.length > 0) {
				const titleMap = new Map<string, string | null>();
				if (daemonConfigured) {
					try {
						const rest = new DaemonRestClient(daemonUrl, supabase);
						for (const c of await rest.listConversations()) titleMap.set(c.id, c.title);
					} catch (err) {
						console.error('Failed to load daemon conversation titles:', err);
					}
				}
				topConversations = sorted.map(([id, tokens]) => ({
					title: titleMap.get(id) || 'Untitled chat',
					tokens
				}));
			}

			// Average per conversation
			const uniqueConvs = convMap.size;
			avgPerConversation = uniqueConvs > 0 ? Math.round(allTimeUsage / uniqueConvs) : 0;
		} catch (err) {
			console.error('Failed to load analytics:', err);
		}
	}
</script>

<section class="mx-auto max-w-6xl">
	<header class="mb-6 flex items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<SlidersHorizontal class="h-6 w-6 text-accent-primary" />
			<div>
				<h1 class="text-2xl font-bold text-white">Bifrost Settings</h1>
				<p class="mt-0.5 text-sm text-slate-400">Connection, token budgets, and usage.</p>
			</div>
		</div>
		<span class="inline-flex shrink-0 items-center gap-1.5 border border-slate-800 bg-slate-900/50 px-2 py-1 text-[11px]">
			<span class="h-2 w-2 rounded-full {daemonConfigured ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
			<span class="text-slate-400">{daemonConfigured ? 'Daemon' : 'Mock mode'}</span>
		</span>
	</header>

	<div class="grid gap-3 md:grid-cols-2">
		<!-- Configuration -->
		<div class="border border-slate-800 bg-slate-900/50">
			<div class="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
				<Activity class="h-4 w-4 text-accent-primary" />
				<h2 class="text-sm font-medium text-white">Configuration</h2>
			</div>
			<dl class="divide-y divide-slate-800 text-xs">
				<div class="flex items-start justify-between gap-3 px-3 py-2">
					<dt class="flex items-center gap-1.5 text-slate-500">
						<Activity class="h-3.5 w-3.5 text-slate-600" />
						Daemon
					</dt>
					<dd class="min-w-0 text-right">
						<span class="text-slate-300">{daemonConfigured ? 'Configured' : 'Mock mode'}</span>
						{#if daemonConfigured}
							<span class="block break-all font-mono text-[10px] text-slate-500">{daemonUrl}</span>
						{:else}
							<span class="block text-[10px] text-slate-500">
								<span class="font-mono">PUBLIC_BIFROST_DAEMON_URL</span> unset
							</span>
						{/if}
					</dd>
				</div>
				<div class="flex items-start justify-between gap-3 px-3 py-2">
					<dt class="flex items-center gap-1.5 text-slate-500">
						<Key class="h-3.5 w-3.5 text-slate-600" />
						Providers
					</dt>
					<dd class="min-w-0 text-right">
						{#if !daemonConfigured}
							<span class="text-slate-500">—</span>
						{:else if !providersLoaded}
							<span class="text-slate-500">checking…</span>
						{:else if providers.length === 0}
							<span class="text-slate-500">none reachable</span>
						{:else}
							{#each providers as p, i (p.name)}<span class="text-slate-700">{i > 0 ? ' · ' : ''}</span><span class={p.available ? 'text-emerald-400' : 'text-slate-500'}>{p.name} {p.available ? '✓' : '✗'}</span>{/each}
						{/if}
					</dd>
				</div>
				<div class="flex items-center justify-between gap-3 px-3 py-2">
					<dt class="flex items-center gap-1.5 text-slate-500">
						<Cpu class="h-3.5 w-3.5 text-slate-600" />
						Models
					</dt>
					<dd class="text-right text-slate-400">pick per chat <span class="text-[10px] text-slate-500">· tiered auto</span></dd>
				</div>
			</dl>
			<p class="border-t border-slate-800 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
				{#if daemonConfigured}
					Provider keys live in the daemon's env (Coolify); the chat model is picked in the session header. Live connection status shows on the Overview tab.
				{:else}
					Chat runs the mock provider until <span class="font-mono">PUBLIC_BIFROST_DAEMON_URL</span> is set (Coolify in prod).
				{/if}
			</p>
		</div>

		<!-- Token Budget -->
		<div class="border border-slate-800 bg-slate-900/50">
			<div class="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
				<Gauge class="h-4 w-4 text-accent-primary" />
				<h2 class="text-sm font-medium text-white">Token Budget</h2>
			</div>
			<div class="space-y-3 px-3 py-3">
				<div>
					<div class="mb-1 flex items-baseline justify-between gap-2 text-xs">
						<label class="text-slate-500" for="daily-limit">Daily limit</label>
						<span class="font-mono text-slate-300">{formatTokenCount(dailyLimit)}</span>
					</div>
					<input id="daily-limit" type="range" min={10000} max={500000} step={10000} bind:value={dailyLimit} class="w-full accent-accent-primary" />
				</div>
				<div>
					<div class="mb-1 flex items-baseline justify-between gap-2 text-xs">
						<label class="text-slate-500" for="monthly-limit">Monthly limit</label>
						<span class="font-mono text-slate-300">{formatTokenCount(monthlyLimit)}</span>
					</div>
					<input id="monthly-limit" type="range" min={100000} max={10000000} step={100000} bind:value={monthlyLimit} class="w-full accent-accent-primary" />
				</div>
				<div>
					<div class="mb-1 flex items-baseline justify-between gap-2 text-xs">
						<label class="text-slate-500" for="conv-limit">Per-conversation</label>
						<span class="font-mono text-slate-300">{formatTokenCount(perConversationLimit)}</span>
					</div>
					<input id="conv-limit" type="range" min={5000} max={200000} step={5000} bind:value={perConversationLimit} class="w-full accent-accent-primary" />
				</div>
				<div>
					<div class="mb-1 flex items-baseline justify-between gap-2 text-xs">
						<label class="text-slate-500" for="warning-threshold">Warning threshold</label>
						<span class="font-mono text-amber-400">{warningThreshold}%</span>
					</div>
					<input id="warning-threshold" type="range" min={50} max={95} step={5} bind:value={warningThreshold} class="w-full accent-amber-500" />
				</div>
				<div class="flex items-center justify-between gap-3 pt-1">
					<p class="text-[10px] leading-snug text-slate-500">
						Enforced by the Bifrost daemon, which also applies its own hard daily cost cap.
					</p>
					<button
						onclick={handleSave}
						disabled={saving}
						class="inline-flex shrink-0 items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:opacity-60"
					>
						{#if saved}
							<Check class="h-4 w-4" />
							Saved
						{:else if saving}
							<Loader2 class="h-4 w-4 animate-spin" />
							Saving...
						{:else}
							<Save class="h-4 w-4" />
							Save
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Preferences -->
		<div class="border border-slate-800 bg-slate-900/50">
			<div class="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
				<SlidersHorizontal class="h-4 w-4 text-accent-primary" />
				<h2 class="text-sm font-medium text-white">Preferences</h2>
			</div>
			<dl class="divide-y divide-slate-800 text-xs">
				<div class="flex items-center justify-between gap-3 px-3 py-2">
					<dt class="flex items-center gap-1.5 text-slate-500">
						<Bot class="h-3.5 w-3.5 text-slate-600" />
						Default agent
					</dt>
					<dd class="text-right text-slate-300">
						Satori <span class="text-[10px] text-slate-500">· switch per chat</span>
					</dd>
				</div>
				<div class="flex items-center justify-between gap-3 px-3 py-2">
					<dt class="flex items-center gap-1.5 text-slate-500">
						<Globe class="h-3.5 w-3.5 text-slate-600" />
						Web search
					</dt>
					<dd class="text-right text-slate-400">Daemon-managed</dd>
				</div>
				<div class="flex items-center justify-between gap-3 px-3 py-2">
					<dt class="flex items-center gap-1.5 text-slate-500">
						<Sparkles class="h-3.5 w-3.5 text-slate-600" />
						Nightly research
					</dt>
					<dd class="text-right text-slate-400">Daemon-managed</dd>
				</div>
				<div class="flex items-center justify-between gap-3 px-3 py-2">
					<dt class="flex items-center gap-1.5 text-slate-500">
						<Palette class="h-3.5 w-3.5 text-slate-600" />
						Appearance
					</dt>
					<dd class="text-right">
						<span class="bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">Soon</span>
					</dd>
				</div>
				<div class="flex items-center justify-between gap-3 px-3 py-2">
					<dt class="flex items-center gap-1.5 text-slate-500">
						<Bell class="h-3.5 w-3.5 text-slate-600" />
						Notifications
					</dt>
					<dd class="text-right">
						<span class="bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">Soon</span>
					</dd>
				</div>
			</dl>
			<p class="border-t border-slate-800 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
				Agent, web search, and nightly research run on the daemon and are configured there; the
				per-chat agent + model live in the session header.
			</p>
		</div>

		<!-- Token Usage Analytics -->
		<div class="border border-slate-800 bg-slate-900/50 md:col-span-2">
			<div class="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
				<div class="flex items-center gap-2">
					<BarChart3 class="h-4 w-4 text-accent-primary" />
					<h2 class="text-sm font-medium text-white">Usage</h2>
				</div>
				<span
					class="text-[10px] uppercase tracking-wide text-slate-500"
					title="Populated once the Bifrost daemon reports token spend via the usage endpoint"
				>
					daemon-reported
				</span>
			</div>
			<div class="grid gap-3 px-3 py-3 lg:grid-cols-2">
				<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
					{#each [['Today', todayUsage], ['Week', weekUsage], ['Month', monthUsage], ['All time', allTimeUsage]] as [label, value] (label)}
						<div class="bg-slate-950 px-2.5 py-1.5">
							<p class="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
							<p class="text-base font-medium text-white">{formatTokenCount(value as number)}</p>
						</div>
					{/each}
				</div>

				<div class="space-y-2">
					{#if topConversations.length > 0}
						<div>
							<p class="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Top conversations</p>
							<div class="space-y-1">
								{#each topConversations as conv, i (i)}
									<div class="flex items-center justify-between gap-2 bg-slate-950 px-2.5 py-1">
										<span class="truncate text-xs text-slate-300">{conv.title}</span>
										<span class="shrink-0 font-mono text-[11px] text-slate-500">
											{formatTokenCount(conv.tokens)}
										</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
					<div class="flex items-center justify-between border-t border-slate-800 pt-2 text-xs">
						<span class="text-slate-500">Avg. per conversation</span>
						<span class="font-mono font-medium text-slate-300">{formatTokenCount(avgPerConversation)}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import {
		Brain,
		MessageCircle,
		MessageSquare,
		Zap,
		RefreshCw,
		ArrowRight,
		Activity,
		Clock,
		Users,
		Loader2
	} from 'lucide-svelte';
	import { env } from '$env/dynamic/public';
	import { DaemonRestClient, type DaemonConversation } from '$lib/data/bifrost/daemon';
	import { formatTokenCount } from '$lib/data/bifrost/token-utils';
	import { AGENTS } from '$lib/config/bifrostAgents';

	interface Props {
		supabase: SupabaseClient;
		/** Lets the parent sub-nav switch tabs from in-card links. */
		onNavigate?: (view: 'chat' | 'memory' | 'agents' | 'settings') => void;
	}

	let { supabase, onNavigate }: Props = $props();

	// Whether a real daemon is configured. When unset/'mock', BifrostChat runs in
	// mock mode and there is no backend behind this landing at all.
	const daemonUrl = env.PUBLIC_BIFROST_DAEMON_URL ?? '';
	const daemonConfigured = !!daemonUrl && daemonUrl !== 'mock';

	type DaemonState = 'online' | 'offline' | 'mock';

	interface RecentSession {
		id: string;
		title: string;
		updated_at: string;
	}

	let loading = $state(true);
	let lastUpdate = $state<number | null>(null);

	let daemon = $state<{
		state: DaemonState;
		uptime: string;
		connections: number;
		conversationCount: number;
	}>({
		state: daemonConfigured ? 'offline' : 'mock',
		uptime: '·',
		connections: 0,
		conversationCount: 0
	});

	let recentSessions = $state<RecentSession[]>([]);
	let usage = $state<{ today: number; allTime: number }>({ today: 0, allTime: 0 });

	function formatUptime(seconds: number): string {
		if (!seconds || seconds < 0) return '·';
		const d = Math.floor(seconds / 86400);
		const h = Math.floor((seconds % 86400) / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (d > 0) return `${d}d ${h}h`;
		if (h > 0) return `${h}h ${m}m`;
		if (m > 0) return `${m}m`;
		return `${Math.floor(seconds)}s`;
	}

	function relativeTime(iso: string): string {
		const then = new Date(iso).getTime();
		if (Number.isNaN(then)) return '';
		const diff = Date.now() - then;
		const sec = Math.floor(diff / 1000);
		if (sec < 60) return 'just now';
		const min = Math.floor(sec / 60);
		if (min < 60) return `${min}m ago`;
		const hr = Math.floor(min / 60);
		if (hr < 24) return `${hr}h ago`;
		const day = Math.floor(hr / 24);
		if (day < 7) return `${day}d ago`;
		return new Date(iso).toLocaleDateString();
	}

	async function loadDaemon() {
		if (!daemonConfigured) {
			daemon = { state: 'mock', uptime: '·', connections: 0, conversationCount: 0 };
			recentSessions = [];
			return;
		}

		const rest = new DaemonRestClient(daemonUrl, supabase);

		// Health — public endpoint.
		try {
			const health = await rest.health();
			daemon = {
				...daemon,
				state: health.status === 'ok' ? 'online' : 'offline',
				uptime: formatUptime(health.uptime),
				connections: health.connections ?? 0
			};
		} catch {
			daemon = { ...daemon, state: 'offline', uptime: '·', connections: 0 };
		}

		// Conversations — authed; guard independently so a failure here doesn't
		// flip the daemon state derived from /health.
		try {
			const convos = await rest.listConversations();
			daemon = { ...daemon, conversationCount: convos.length };
			recentSessions = [...convos]
				.sort(
					(a: DaemonConversation, b: DaemonConversation) =>
						new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
				)
				.slice(0, 5)
				.map((c) => ({ id: c.id, title: c.title || 'New chat', updated_at: c.updated_at }));
		} catch {
			recentSessions = [];
		}
	}

	async function loadUsage() {
		if (!supabase) return;
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) return;

			const todayStart = new Date();
			todayStart.setUTCHours(0, 0, 0, 0);

			// Billable (paid) usage only — $0 OpenRouter :free exchanges are flagged
			// billable=false and excluded so the overview matches budget accounting.
			const { data: rows } = await supabase
				.from('bifrost_token_usage')
				.select('input_tokens, output_tokens, created_at')
				.eq('user_id', user.id)
				.eq('billable', true);

			if (!rows) return;

			const sum = (list: typeof rows) =>
				list.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);

			usage = {
				allTime: sum(rows),
				today: sum(rows.filter((r) => new Date(r.created_at) >= todayStart))
			};
		} catch (err) {
			console.error('Failed to load Bifrost usage:', err);
		}
	}

	async function loadAll() {
		loading = true;
		await Promise.all([loadDaemon(), loadUsage()]);
		lastUpdate = Date.now();
		loading = false;
	}

	onMount(() => {
		loadAll();
	});

	function statusDot(s: DaemonState): string {
		return s === 'online' ? 'animate-pulse bg-emerald-400' : 'bg-slate-600';
	}

	function statusLabel(s: DaemonState): string {
		return s === 'online' ? 'ONLINE' : s === 'mock' ? 'MOCK MODE' : 'OFFLINE';
	}
</script>

<div class="mx-auto max-w-6xl space-y-3">
	<div class="flex items-center justify-between border-b border-slate-800 pb-3">
		<header class="flex items-center gap-3">
			<Activity class="h-6 w-6 text-accent-primary" />
			<div>
				<h1 class="text-2xl font-bold text-white">Bifrost — Overview</h1>
				<p class="mt-0.5 text-sm text-slate-400">
					Daemon status, sessions, and the realm-agents at a glance.
				</p>
			</div>
		</header>
		<div class="flex items-center gap-3 text-[11px] text-slate-500">
			{#if lastUpdate}
				<span class="hidden sm:inline">updated {new Date(lastUpdate).toLocaleTimeString()}</span>
			{/if}
			<button
				onclick={loadAll}
				class="p-2 text-slate-400 transition hover:bg-slate-800 hover:text-accent-primary"
				title="Refresh"
				aria-label="Refresh"
			>
				<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
			</button>
		</div>
	</div>

	<!-- Daemon status banner -->
	<section class="border border-slate-800 bg-slate-900/50">
		<header class="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
			<div class="flex items-center gap-2">
				<Activity class="h-4 w-4 text-slate-400" />
				<div>
					<div class="text-sm font-medium tracking-wide text-white">Daemon Status</div>
					<div class="text-[10px] uppercase tracking-wider text-slate-500">Bifrost daemon</div>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<span class="h-2 w-2 rounded-full {statusDot(daemon.state)}"></span>
				<span class="text-[10px] uppercase tracking-wider text-slate-300">{statusLabel(daemon.state)}</span>
			</div>
		</header>
		<div class="p-3">
			{#if loading}
				<div class="flex items-center justify-center py-6">
					<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
					<div class="flex flex-col items-center justify-center bg-slate-950 p-3">
						<Clock class="mb-1 h-4 w-4 text-accent-primary" />
						<div class="font-mono text-lg text-white">{daemon.uptime}</div>
						<div class="text-[10px] uppercase tracking-wider text-slate-500">Uptime</div>
					</div>
					<div class="flex flex-col items-center justify-center bg-slate-950 p-3">
						<Users class="mb-1 h-4 w-4 text-accent-primary" />
						<div class="font-mono text-lg text-white">{daemon.connections}</div>
						<div class="text-[10px] uppercase tracking-wider text-slate-500">Connections</div>
					</div>
					<div class="flex flex-col items-center justify-center bg-slate-950 p-3">
						<MessageSquare class="mb-1 h-4 w-4 text-accent-primary" />
						<div class="font-mono text-lg text-white">{formatTokenCount(usage.today)}</div>
						<div class="text-[10px] uppercase tracking-wider text-slate-500">Tokens today</div>
					</div>
					<div class="flex flex-col items-center justify-center bg-slate-950 p-3">
						<Zap class="mb-1 h-4 w-4 text-accent-primary" />
						<div class="font-mono text-lg text-white">{formatTokenCount(usage.allTime)}</div>
						<div class="text-[10px] uppercase tracking-wider text-slate-500">Tokens all-time</div>
					</div>
				</div>
				{#if daemon.state === 'mock'}
					<p class="mt-3 text-[11px] text-slate-500">
						Daemon not configured — chat runs the mock provider. Set
						<span class="font-mono text-slate-400">PUBLIC_BIFROST_DAEMON_URL</span> to connect the daemon.
					</p>
				{:else if daemon.state === 'offline'}
					<p class="mt-3 text-[11px] text-slate-500">
						Daemon configured but not reachable — health check failed.
					</p>
				{/if}
			{/if}
		</div>
	</section>

	<div class="grid grid-cols-1 gap-3 xl:grid-cols-3">
		<!-- Recent Sessions (wide, spans 2 cols) -->
		<section class="border border-slate-800 bg-slate-900/50 xl:col-span-2">
			<header class="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
				<div class="flex items-center gap-2">
					<MessageCircle class="h-4 w-4 text-slate-400" />
					<div>
						<div class="text-sm font-medium tracking-wide text-white">Recent Sessions</div>
						<div class="text-[10px] uppercase tracking-wider text-slate-500">
							{daemon.conversationCount} conversation{daemon.conversationCount === 1 ? '' : 's'}
						</div>
					</div>
				</div>
				<button
					onclick={() => onNavigate?.('chat')}
					class="flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-accent-primary"
				>
					Chat
					<ArrowRight class="h-3 w-3" />
				</button>
			</header>
			<div class="p-3">
				{#if loading}
					<div class="flex items-center justify-center py-6">
						<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
					</div>
				{:else if recentSessions.length === 0}
					<div class="py-6 text-center text-[11px] text-slate-500">No conversations yet</div>
				{:else}
					<ul class="divide-y divide-slate-800">
						{#each recentSessions as session (session.id)}
							<li class="first:pt-0 last:pb-0">
								<button
									onclick={() => onNavigate?.('chat')}
									class="group flex w-full items-center gap-3 py-3 text-left transition hover:bg-slate-800/40"
								>
									<div class="border border-slate-800 bg-slate-950 p-1.5">
										<MessageCircle class="h-3.5 w-3.5 text-accent-primary" />
									</div>
									<div class="min-w-0 flex-1">
										<div class="truncate text-sm text-slate-200 group-hover:text-white">
											{session.title}
										</div>
									</div>
									<span class="shrink-0 font-mono text-[10px] text-slate-500">
										{relativeTime(session.updated_at)}
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>

		<!-- Memory -->
		<section class="border border-slate-800 bg-slate-900/50">
			<header class="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
				<div class="flex items-center gap-2">
					<Brain class="h-4 w-4 text-slate-400" />
					<div>
						<div class="text-sm font-medium tracking-wide text-white">Memory</div>
						<div class="text-[10px] uppercase tracking-wider text-slate-500">Institutional knowledge</div>
					</div>
				</div>
				<button
					onclick={() => onNavigate?.('memory')}
					class="flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-accent-primary"
				>
					View
					<ArrowRight class="h-3 w-3" />
				</button>
			</header>
			<div class="p-3">
				<button
					onclick={() => onNavigate?.('memory')}
					class="group flex w-full items-center justify-between bg-slate-950 p-3 transition hover:bg-slate-800/60"
				>
					<div class="flex items-center gap-2">
						<Brain class="h-4 w-4 text-accent-primary" />
						<span class="text-xs text-slate-300 group-hover:text-white">Browse memory</span>
					</div>
					<ArrowRight class="h-3 w-3 text-slate-500 transition group-hover:text-accent-primary" />
				</button>
			</div>
		</section>

		<!-- Agents -->
		<section class="border border-slate-800 bg-slate-900/50">
			<header class="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
				<div class="flex items-center gap-2">
					<Users class="h-4 w-4 text-slate-400" />
					<div>
						<div class="text-sm font-medium tracking-wide text-white">Agents</div>
						<div class="text-[10px] uppercase tracking-wider text-slate-500">The realm-agents</div>
					</div>
				</div>
				<button
					onclick={() => onNavigate?.('agents')}
					class="flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-accent-primary"
				>
					View all
					<ArrowRight class="h-3 w-3" />
				</button>
			</header>
			<div class="p-3">
				<ul class="divide-y divide-slate-800">
					{#each AGENTS as agent (agent.key)}
						<li class="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
							<div class="min-w-0">
								<span class="text-xs text-slate-200">{agent.name}</span>
								<span class="text-slate-700"> · </span>
								<span class="text-[11px] text-slate-500">{agent.role}</span>
							</div>
							<span class="shrink-0 font-mono text-[10px] text-slate-500">{agent.defaultModel}</span>
						</li>
					{/each}
				</ul>
			</div>
		</section>

		<!-- Quick launchers -->
		<section class="border border-slate-800 bg-slate-900/50">
			<header class="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
				<div class="flex items-center gap-2">
					<MessageCircle class="h-4 w-4 text-slate-400" />
					<div>
						<div class="text-sm font-medium tracking-wide text-white">Ask the agent</div>
						<div class="text-[10px] uppercase tracking-wider text-slate-500">Direct conversation</div>
					</div>
				</div>
			</header>
			<div class="space-y-2 p-3">
				<button
					onclick={() => onNavigate?.('chat')}
					class="group flex w-full items-center justify-between bg-slate-950 p-3 transition hover:bg-slate-800/60"
				>
					<div class="flex items-center gap-2">
						<MessageCircle class="h-4 w-4 text-accent-primary" />
						<span class="text-xs text-slate-300 group-hover:text-white">Start a chat</span>
					</div>
					<ArrowRight class="h-3 w-3 text-slate-500 transition group-hover:text-accent-primary" />
				</button>
				<button
					onclick={() => onNavigate?.('settings')}
					class="group flex w-full items-center justify-between bg-slate-950 p-3 transition hover:bg-slate-800/60"
				>
					<div class="flex items-center gap-2">
						<Zap class="h-4 w-4 text-accent-primary" />
						<span class="text-xs text-slate-300 group-hover:text-white">Settings & budget</span>
					</div>
					<ArrowRight class="h-3 w-3 text-slate-500 transition group-hover:text-accent-primary" />
				</button>
			</div>
		</section>
	</div>
</div>

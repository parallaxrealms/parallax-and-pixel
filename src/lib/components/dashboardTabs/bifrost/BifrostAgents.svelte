<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { Users, Cpu, Wrench, AlertTriangle, ChevronDown, Loader2 } from 'lucide-svelte';
	import { env } from '$env/dynamic/public';
	import { DaemonRestClient, type AgentToolInfo, type AgentAutomation } from '$lib/data/bifrost/daemon';
	import { AGENTS, AGENT_AXES, ROADMAP_AGENTS, type AgentKey } from '$lib/config/bifrostAgents';
	import DaedalusView from '$lib/daedalus/DaedalusView.svelte';
	import { radarScene } from '$lib/daedalus/embed';
	import AgentAutomationToggle from './AgentAutomationToggle.svelte';

	interface Props {
		supabase: SupabaseClient;
	}

	let { supabase }: Props = $props();

	const daemonUrl = env.PUBLIC_BIFROST_DAEMON_URL ?? '';
	const daemonConfigured = !!daemonUrl && daemonUrl !== 'mock';

	const AXES = [...AGENT_AXES];
	const FALLBACK_AVATAR = '/icon.webp';

	// Per-agent DAEDALUS radar scenes, built once (keyed by agent key). Each agent's
	// capability stats become a single-series radar; the scene inherits the card's
	// accent theme via DaedalusView.
	const radarScenes = $derived(
		Object.fromEntries(
			AGENTS.map((a) => [
				a.key,
				radarScene(a.name, AXES, [{ name: a.name, values: a.stats }], { max: 5 })
			])
		)
	);

	// Per-agent live-tools state, keyed by agent key.
	type ToolState = { loading: boolean; tools: AgentToolInfo[]; error: boolean };
	let toolsByAgent = $state<Record<string, ToolState>>(
		Object.fromEntries(AGENTS.map((a) => [a.key, { loading: true, tools: [], error: false }]))
	);

	// Live-tools collapse state, keyed by agent key. Pre-collapsed (false) by default.
	let toolsOpen = $state<Record<string, boolean>>({});

	function toggleToolsOpen(key: string) {
		toolsOpen = { ...toolsOpen, [key]: !toolsOpen[key] };
	}

	$effect(() => {
		void loadTools();
	});

	async function loadTools() {
		if (!daemonConfigured) {
			// No daemon — mark every agent as "no tools" rather than spinning forever.
			toolsByAgent = Object.fromEntries(
				AGENTS.map((a) => [a.key, { loading: false, tools: [], error: false }])
			);
			return;
		}

		const rest = new DaemonRestClient(daemonUrl, supabase);
		const results = await Promise.allSettled(AGENTS.map((a) => rest.listAgentTools(a.key)));

		const next: Record<string, ToolState> = {};
		AGENTS.forEach((a, i) => {
			const r = results[i];
			if (r.status === 'fulfilled') {
				next[a.key] = { loading: false, tools: r.value, error: false };
			} else {
				next[a.key] = { loading: false, tools: [], error: true };
			}
		});
		toolsByAgent = next;
	}

	// Each agent's scheduled-job master switch lives in its card header, loaded from
	// the unified /api/agents/automation endpoint — the single source of truth every
	// toggle shares. Matched to a card by automation.agent === agent.key.
	let automations = $state<AgentAutomation[]>([]);

	$effect(() => {
		void loadAutomations();
	});

	async function loadAutomations() {
		if (!daemonConfigured) {
			automations = [];
			return;
		}
		try {
			automations = await new DaemonRestClient(daemonUrl, supabase).getAgentAutomation();
		} catch (e) {
			console.error('[BifrostAgents] failed to load automations', e);
			automations = [];
		}
	}

	function automationFor(agentKey: string): AgentAutomation | undefined {
		return automations.find((a) => a.agent === agentKey);
	}

	function avatarFallback(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		if (img.src.endsWith(FALLBACK_AVATAR)) return; // already the fallback — avoid loops
		img.src = FALLBACK_AVATAR;
	}

	function riskClass(risk: AgentToolInfo['risk']): string {
		if (risk === 'high') return 'text-red-400/80';
		if (risk === 'medium') return 'text-amber-400/80';
		return 'text-emerald-400/70';
	}

	function toolsState(key: AgentKey): ToolState {
		return toolsByAgent[key] ?? { loading: false, tools: [], error: false };
	}
</script>

<section class="mx-auto max-w-6xl">
	<header class="mb-6 flex items-center gap-3">
		<Users class="h-6 w-6 text-accent-primary" />
		<div>
			<h1 class="text-2xl font-bold text-white">Agents</h1>
			<p class="mt-0.5 text-sm text-slate-400">
				The realm-agents — capabilities, vitals, and live tool palettes.
			</p>
		</div>
	</header>

	<!-- Live agent grid -->
	<div class="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
		{#each AGENTS as agent (agent.key)}
			{@const ts = toolsState(agent.key)}
			{@const auto = automationFor(agent.key)}
			<article class="flex flex-col border border-slate-800 bg-slate-900/50">
				<!-- Card header: avatar, name, role, status dot — automation toggle top-right -->
				<header class="flex items-center gap-3 border-b border-slate-800 px-3 py-3">
					<img
						src={agent.avatar}
						alt={agent.name}
						onerror={avatarFallback}
						class="h-11 w-11 shrink-0 border border-slate-700 bg-slate-950 object-cover"
					/>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-1.5">
							<h2 class="truncate text-base font-semibold text-white">{agent.name}</h2>
							<span class="h-2 w-2 shrink-0 rounded-full bg-emerald-400" title="live" aria-label="live"></span>
						</div>
						<p class="truncate text-xs text-slate-500">{agent.role}</p>
					</div>
					{#if auto}
						<AgentAutomationToggle {supabase} automation={auto} compact onToggled={() => loadAutomations()} />
					{/if}
				</header>

				<!-- Radar -->
				<div class="flex justify-center px-3 py-3">
					<DaedalusView scene={radarScenes[agent.key]} height="240px" />
				</div>

				<!-- Vitals -->
				<div class="border-t border-slate-800 px-3 py-2">
					<div class="flex items-center gap-1.5 text-[11px] text-slate-500">
						<Cpu class="h-3.5 w-3.5 text-slate-600" />
						<span class="font-mono text-slate-400">{agent.stack}</span>
						<span class="text-slate-700">·</span>
						<span class="font-mono text-slate-400">{agent.defaultModel}</span>
					</div>
					<p class="mt-1.5 text-xs leading-relaxed text-slate-400">{agent.domain}</p>
					<p class="mt-1 text-[11px] italic leading-relaxed text-slate-500">{agent.personality}</p>
				</div>

				<!-- Live tools (collapsible, pre-collapsed) -->
				<div class="border-t border-slate-800 px-3 py-2">
					<button
						type="button"
						onclick={() => toggleToolsOpen(agent.key)}
						class="flex w-full items-center gap-1.5 text-left"
						aria-expanded={!!toolsOpen[agent.key]}
					>
						<Wrench class="h-3.5 w-3.5 text-accent-primary" />
						<span class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Live tools</span>
						<span class="ml-auto flex items-center gap-1.5">
							{#if !ts.loading && !ts.error && ts.tools.length > 0}
								<span class="bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{ts.tools.length}</span>
							{/if}
							<ChevronDown class="h-3.5 w-3.5 text-slate-500 transition-transform {toolsOpen[agent.key] ? 'rotate-180' : ''}" />
						</span>
					</button>

					{#if toolsOpen[agent.key]}
						<div class="mt-1.5">
							{#if ts.loading}
								<div class="flex items-center gap-2 py-1 text-xs text-slate-500">
									<Loader2 class="h-3.5 w-3.5 animate-spin" /> Loading tools…
								</div>
							{:else if ts.error}
								<p class="flex items-center gap-1.5 py-1 text-xs text-amber-400/80">
									<AlertTriangle class="h-3.5 w-3.5" /> Couldn't reach the daemon.
								</p>
							{:else if ts.tools.length === 0}
								<p class="py-1 text-xs text-slate-500">Answers from context — no tools yet.</p>
							{:else}
								<ul class="space-y-1">
									{#each ts.tools as tool (tool.name)}
										<li class="flex items-start gap-2 text-xs leading-relaxed">
											<span
												class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full {riskClass(tool.risk)}"
												style="background-color: currentColor"
												title="{tool.risk} risk"
											></span>
											<span class="min-w-0 flex-1">
												<span class="text-slate-300">{tool.label}</span>
												{#if tool.description}
													<span class="text-slate-500"> — {tool.description}</span>
												{/if}
											</span>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/if}
				</div>
			</article>
		{/each}
	</div>

	<!-- Roadmap -->
	<div class="mt-6">
		<h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Roadmap</h2>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
			{#each ROADMAP_AGENTS as agent (agent.name)}
				<div class="border border-slate-800 bg-slate-900/30 px-3 py-2.5 opacity-70">
					<div class="flex items-center justify-between gap-2">
						<span class="text-sm font-medium text-slate-400">{agent.name}</span>
						<span class="bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">planned</span>
					</div>
					<p class="mt-0.5 text-[11px] text-slate-500">{agent.role}</p>
					<div class="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
						<span class="font-mono">{agent.stack}</span>
					</div>
					<p class="mt-1 text-[11px] leading-relaxed text-slate-500">{agent.domain}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

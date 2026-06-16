<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { MessageSquare, Plus, Send, Trash2, WifiOff, RefreshCw, Star, PanelLeftOpen, X, Cpu, Copy, ClipboardCheck, Pencil, Maximize2, Minimize2, Wrench, Scissors, AlertTriangle, Loader2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { isChatFullscreen, toggleChatFullscreen, setChatFullscreen } from '$lib/stores/chatFullscreen.svelte';
	import * as Select from '$lib/components/shadcn/ui/select';
	import { fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import ChatMessage from './components/ChatMessage.svelte';
	import ToolActivity from './components/ToolActivity.svelte';
	import ChatToolsPanel from './components/ChatToolsPanel.svelte';
	import { env } from '$env/dynamic/public';
	import { colorForAgent } from '$lib/config/bifrostSessionColors';
	import { AGENTS, agentMeta, resolveAgentKey } from '$lib/config/bifrostAgents';
	import { formatTokenCount } from '$lib/data/bifrost/token-utils';
	import {
		initBifrost,
		teardownBifrost,
		getBifrostState,
		createConversation,
		selectConversation,
		deleteConversation as deleteConv,
		renameConversation,
		setConversationAgent,
		regenerateLast,
		editAndResend,
		sendMessage as sendMsg,
		cancelStream,
		retryConnection,
		setModel,
		compactActiveConversation,
		dismissCompactionNotice,
	} from '$lib/stores/bifrost.svelte';

	interface Props {
		supabase: SupabaseClient;
	}

	let { supabase }: Props = $props();

	// Fallback avatar when an agent's webp isn't shipped in /static.
	const FALLBACK_AVATAR = '/icon.webp';

	// Per-agent "thinking" flavor — themed to each realm-agent's ethos. A random
	// phrase is chosen when a turn is sent and held until the first chunk arrives.
	const AGENT_THINKING_PHRASES: Record<string, string[]> = {
		satori: ['Meditating on it…', 'Seeking satori…', 'Finding the still point…', 'Sitting with the question…', 'Letting the answer arise…', 'Polishing the mirror…'],
		mimir: ['Consulting the Norns…', 'Peering into the well…', 'Drawing from the deep water…', 'Listening at the roots of Yggdrasil…', 'Weighing the runes…'],
		vulcan: ['Stoking the forge…', 'Hammering it out…', 'Tempering the answer…', 'At the anvil…'],
		odin: ['Sending out the ravens…', 'Surveying the nine realms…', 'Consulting Huginn and Muninn…', 'Weighing it from the high seat…'],
		heimdall: ['Scanning the horizon…', 'Watching the bridge…', 'Listening across the realms…'],
		thoth: ['Inking the scroll…', 'Consulting the records…', 'Drafting the reply…'],
		bifrost: ['Crossing the bridge…', 'Channeling the spectrum…', 'Spanning the realms…']
	};
	const DEFAULT_THINKING = ['Thinking…', 'Working on it…'];
	let thinkingPhrase = $state('');
	function pickThinkingPhrase() {
		const set = AGENT_THINKING_PHRASES[activeAgentId] ?? DEFAULT_THINKING;
		thinkingPhrase = set[Math.floor(Math.random() * set.length)];
	}

	// Get reactive state from store
	const bifrost = getBifrostState();

	// App-like fullscreen: hides the dashboard chrome so the chat owns the viewport.
	const isFullscreen = $derived(isChatFullscreen());

	// Active agent + its theming, avatar, and name — reactive so switching the
	// agent re-themes the session immediately.
	const activeAgentId = $derived(bifrost.activeAgent);
	const sessionColor = $derived(colorForAgent(activeAgentId));
	const avatarSrc = $derived(agentMeta(activeAgentId).avatar);
	const agentName = $derived(agentMeta(activeAgentId).name);

	// Switching the agent rebinds the active conversation (or, with no conversation
	// yet, just primes the next New Chat). Persisted by the store.
	async function handleAgentChange(key: string) {
		await setConversationAgent(bifrost.activeConversationId, key);
	}

	// Inline edit-and-resend of a prior user message.
	let editingMessageId = $state<string | null>(null);
	let editingMessageText = $state('');
	function startEditMessage(id: string, content: string) {
		editingMessageId = id;
		editingMessageText = content;
	}
	function cancelEditMessage() {
		editingMessageId = null;
		editingMessageText = '';
	}
	async function commitEditMessage() {
		const id = editingMessageId;
		const text = editingMessageText;
		editingMessageId = null;
		editingMessageText = '';
		if (id && text.trim()) await editAndResend(id, text);
	}

	// Current model for this session (most recent assistant message's model, else
	// the client's selected model preference).
	const currentModel = $derived.by(() => {
		const msgs = bifrost.activeMessages;
		for (let i = msgs.length - 1; i >= 0; i--) {
			if (msgs[i].role === 'assistant' && msgs[i].model) return msgs[i].model as string;
		}
		return bifrost.model;
	});

	const contextPct = $derived.by(() => {
		const t = bifrost.contextTokens;
		const limit = bifrost.contextLimit;
		if (t == null || !limit) return null;
		return Math.min(100, Math.round((t / limit) * 100));
	});
	const selectedModelLabel = $derived(
		bifrost.availableModels.find((m) => m.id === bifrost.model)?.label ?? bifrost.model
	);
	const budgetPct = $derived.by(() => {
		const limit = bifrost.dailyLimit;
		if (!limit) return null;
		return Math.min(100, Math.round((bifrost.dailyTokens / limit) * 100));
	});
	function barColor(pct: number): string {
		if (pct >= 100) return '#f87171';
		if (pct >= 80) return '#fbbf24';
		return sessionColor.accent;
	}

	const contextWarning = $derived.by<null | { level: 'amber' | 'red'; bg: string; border: string; text: string }>(() => {
		const pct = contextPct;
		if (pct == null || pct < 75) return null;
		return pct >= 90
			? { level: 'red', bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.4)', text: '#fca5a5' }
			: { level: 'amber', bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.4)', text: '#fcd34d' };
	});

	// Compaction (condense earlier turns into a summary to reclaim the context window).
	const canCompact = $derived(
		bifrost.connectionStatus === 'connected'
		&& bifrost.activeConversationId !== null
		&& !bifrost.streaming
	);
	let compacting = $state(false);
	async function runCompaction() {
		if (!canCompact || compacting) return;
		compacting = true;
		try {
			const result = await compactActiveConversation();
			if (!result) return;
			if (result.compacted) {
				toast.success('Condensed earlier turns');
			} else {
				toast.message(result.reason ?? 'Nothing to compact yet');
			}
		} finally {
			compacting = false;
		}
	}

	// Local UI state
	let showTools = $state(false);
	let inputValue = $state('');
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let confirmDeleteId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let editingTitle = $state('');

	function focusOnMount(node: HTMLInputElement | HTMLTextAreaElement) {
		node.focus();
		node.select();
	}

	async function commitRename(id: string) {
		if (editingId !== id) return;
		const title = editingTitle.trim();
		editingId = null;
		editingTitle = '';
		if (title) await renameConversation(id, title);
	}
	let disconnectedTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let showOfflineMessage = $state(false);
	let isMobile = $state(browser ? window.innerWidth <= 768 : false);
	let showMobileSidebar = $state(false);

	$effect(() => {
		if (!browser) return;
		const handleResize = () => {
			isMobile = window.innerWidth <= 768;
			if (!isMobile) showMobileSidebar = false;
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// Keyboard-aware lift for iOS Safari.
	let keyboardInset = $state(0);
	$effect(() => {
		if (!browser) return;
		const vv = window.visualViewport;
		if (!vv) return;
		const update = () => {
			keyboardInset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
		};
		update();
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
		};
	});

	// Track disconnected duration for offline message.
	$effect(() => {
		if (bifrost.connectionStatus === 'disconnected' || bifrost.connectionStatus === 'reconnecting') {
			if (!disconnectedTimer) {
				disconnectedTimer = setTimeout(() => {
					showOfflineMessage = true;
				}, 30_000);
			}
		} else {
			if (disconnectedTimer) {
				clearTimeout(disconnectedTimer);
				disconnectedTimer = null;
			}
			showOfflineMessage = false;
		}
	});

	// Autoscroll that respects user scroll-up.
	let pinned = $state(true);
	const PIN_THRESHOLD = 40;

	function updatePinned() {
		if (!messagesContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
		pinned = scrollHeight - (scrollTop + clientHeight) <= PIN_THRESHOLD;
	}

	function scrollToBottom() {
		if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
	}

	function jumpToLatest() {
		pinned = true;
		scrollToBottom();
	}

	$effect(() => {
		bifrost.activeMessages.length;
		bifrost.streamingContent;
		if (pinned) scrollToBottom();
	});

	$effect(() => {
		bifrost.activeConversationId;
		pinned = true;
		scrollToBottom();
	});

	// Initialize — daemon mode if URL configured, "not configured" banner otherwise.
	onMount(() => {
		const daemonUrl = env.PUBLIC_BIFROST_DAEMON_URL || 'mock';
		initBifrost(supabase, daemonUrl);
	});

	onDestroy(() => {
		teardownBifrost();
		setChatFullscreen(false);
		if (disconnectedTimer) clearTimeout(disconnectedTimer);
	});

	function resizeTextarea() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		const maxHeight = 4 * 24;
		textareaEl.style.height = Math.min(textareaEl.scrollHeight, maxHeight) + 'px';
	}

	async function handleNewChat() {
		await createConversation();
		inputValue = '';
	}

	async function handleSelectConversation(id: string) {
		await selectConversation(id);
		showMobileSidebar = false;
	}

	async function handleDeleteConversation(id: string) {
		await deleteConv(id);
		confirmDeleteId = null;
	}

	function handleSend() {
		const content = inputValue.trim();
		if (!content || bifrost.streaming) return;
		// Client slash-command: /help (or /tools) opens the tool reference.
		if (content === '/help' || content === '/tools') {
			inputValue = '';
			if (textareaEl) textareaEl.style.height = 'auto';
			showTools = true;
			return;
		}
		// Client slash-command: /compact (or /condense) condenses earlier turns.
		if (content === '/compact' || content === '/condense') {
			inputValue = '';
			if (textareaEl) textareaEl.style.height = 'auto';
			runCompaction();
			return;
		}
		if (bifrost.connectionStatus !== 'connected') return;
		if (!bifrost.activeConversationId) return;

		inputValue = '';
		if (textareaEl) textareaEl.style.height = 'auto';
		pickThinkingPhrase();
		sendMsg(content);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function handleRetry() {
		retryConnection();
	}

	function handleCancelStream() {
		cancelStream();
	}

	// Copy the active conversation to the clipboard as "Speaker: message" lines.
	let copied = $state(false);
	async function copyConversationLog() {
		const lines = bifrost.activeMessages
			.filter((m) => m.role === 'user' || m.role === 'assistant')
			.map((m) => `${m.role === 'user' ? 'You' : agentName}: ${m.content}`);
		if (lines.length === 0) return;
		try {
			await navigator.clipboard.writeText(lines.join('\n\n'));
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch (err) {
			console.error('Copy conversation failed:', err);
		}
	}

	// Connection status display
	const statusConfig = $derived.by(() => {
		switch (bifrost.connectionStatus) {
			case 'connected': return { color: 'bg-emerald-500', text: 'Connected' };
			case 'connecting': return { color: 'animate-pulse bg-yellow-500', text: 'Connecting...' };
			case 'reconnecting': return { color: 'animate-pulse bg-yellow-500', text: 'Reconnecting...' };
			case 'disconnected': return { color: 'bg-red-500', text: 'Disconnected' };
			case 'error': return { color: 'bg-red-500', text: 'Connection lost' };
			default: return { color: 'bg-slate-500', text: '' };
		}
	});

	const canSend = $derived(
		inputValue.trim().length > 0
		&& !bifrost.streaming
		&& bifrost.connectionStatus === 'connected'
		&& bifrost.activeConversationId !== null
	);

	const displayMessages = $derived(
		bifrost.activeMessages.filter((m) => m.role === 'user' || m.role === 'assistant')
	);
	const canRegenerate = $derived(
		!bifrost.streaming
		&& bifrost.connectionStatus === 'connected'
		&& displayMessages.length > 0
		&& displayMessages[displayMessages.length - 1].role === 'assistant'
	);
</script>

{#if bifrost.notConfigured}
	<!-- Graceful degradation: no daemon URL configured. -->
	<section class="flex h-full items-center justify-center p-6">
		<div class="max-w-md border border-amber-500/40 bg-amber-500/10 p-6 text-center">
			<AlertTriangle class="mx-auto mb-3 h-8 w-8 text-amber-400" />
			<p class="mb-1 text-sm font-medium text-amber-300">Bifrost daemon is not configured.</p>
			<p class="text-xs text-slate-400">
				Set <span class="font-mono text-slate-300">PUBLIC_BIFROST_DAEMON_URL</span> to the wss/https
				base of your Bifrost daemon to enable chat.
			</p>
		</div>
	</section>
{:else}
<section class="flex h-full flex-col">
	<div class="relative flex min-h-0 flex-1 gap-0">
		<!-- Mobile sidebar backdrop -->
		{#if isMobile && showMobileSidebar}
			<button
				class="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm {isFullscreen ? 'top-0' : 'top-[5.5rem]'}"
				onclick={() => (showMobileSidebar = false)}
				aria-label="Close conversations"
				tabindex="-1"
				transition:fade={{ duration: 150 }}
			></button>
		{/if}

		<!-- Conversation sidebar -->
		<div
			class="{isMobile
				? `fixed left-0 z-40 w-64 ${isFullscreen ? 'top-0 h-[100dvh]' : 'top-[5.5rem] h-[calc(100dvh_-_5.5rem)]'} transition-transform duration-300 ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}`
				: 'w-52 shrink-0'} flex flex-col border-r border-slate-800 bg-slate-900/95"
		>
			{#if isMobile}
				<!-- Mobile sidebar header with close -->
				<div class="flex items-center justify-between border-b border-slate-800 px-3 pt-3 pb-2">
					<span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversations</span>
					<button onclick={() => (showMobileSidebar = false)} class="p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300">
						<X class="h-4 w-4" />
					</button>
				</div>
			{:else}
				<!-- Agent avatar (desktop only) -->
				<div class="flex items-center justify-center border-b border-slate-800">
					<img
						src={avatarSrc}
						alt={agentName}
						onerror={(e) => { const t = e.currentTarget as HTMLImageElement; t.onerror = null; t.src = FALLBACK_AVATAR; }}
						class="h-[256px] w-[256px] object-cover"
					/>
				</div>
			{/if}

			<div class="flex items-center gap-2 border-b border-slate-800 px-2 py-1.5">
				<button
					onclick={handleNewChat}
					disabled={bifrost.connectionStatus !== 'connected'}
					class="flex flex-1 items-center justify-center gap-1.5 bg-accent-primary px-2 py-2.5 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 md:py-1.5 md:text-xs"
				>
					<Plus class="h-3 w-3" />
					New Chat
				</button>
				<div class="flex items-center gap-1" title={statusConfig.text}>
					<span class="h-1.5 w-1.5 rounded-full {statusConfig.color}"></span>
					{#if bifrost.connectionStatus === 'error' || bifrost.connectionStatus === 'disconnected'}
						<button onclick={handleRetry} class="text-[10px] text-accent-primary transition hover:opacity-80">retry</button>
					{/if}
				</div>
			</div>
			<div class="flex-1 overflow-y-auto px-1 pt-1 pb-16 md:pb-2">
				{#if bifrost.conversations.length === 0}
					<p class="py-6 text-center text-[11px] text-slate-600">No conversations</p>
				{:else}
					{#each bifrost.conversations as conv (conv.id)}
						<div
							role="button"
							tabindex="0"
							onclick={() => handleSelectConversation(conv.id)}
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectConversation(conv.id); }}
							class="group flex w-full cursor-pointer items-center justify-between px-2 py-1.5 text-left transition-colors {conv.id ===
							bifrost.activeConversationId
								? 'border-l-2 border-accent-primary bg-accent-primary/10 text-accent-primary'
								: 'border-l-2 border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}"
						>
							{#if editingId === conv.id}
								<input
									value={editingTitle}
									oninput={(e) => (editingTitle = e.currentTarget.value)}
									onclick={(e) => e.stopPropagation()}
									onkeydown={(e) => {
										e.stopPropagation();
										if (e.key === 'Enter') commitRename(conv.id);
										else if (e.key === 'Escape') { editingId = null; editingTitle = ''; }
									}}
									onblur={() => commitRename(conv.id)}
									use:focusOnMount
									class="min-w-0 flex-1 border border-accent-primary bg-slate-800 px-1 py-0.5 text-xs text-white focus:outline-none"
								/>
							{:else}
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-1">
										<!-- Agent badge: which agent this chat is bound to. -->
										<span
											class="h-1.5 w-1.5 shrink-0 rounded-full"
											style="background: {colorForAgent(resolveAgentKey(conv.agent)).accent};"
											title={agentMeta(conv.agent).name}
										></span>
										{#if conv.visibility === 'team'}
											<Star class="h-2.5 w-2.5 shrink-0 text-amber-400" />
										{/if}
										<span class="truncate text-xs leading-tight">{conv.title || 'New chat'}</span>
									</div>
								</div>
								{#if confirmDeleteId === conv.id}
									<div class="flex gap-0.5" transition:fade={{ duration: 100 }}>
										<button
											onclick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
											class="px-1 py-0.5 text-[10px] text-red-400 hover:bg-red-500/20"
										>Yes</button>
										<button
											onclick={(e) => { e.stopPropagation(); confirmDeleteId = null; }}
											class="px-1 py-0.5 text-[10px] text-slate-500 hover:bg-slate-700"
										>No</button>
									</div>
								{:else}
									<div class="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
										<button
											onclick={(e) => { e.stopPropagation(); editingId = conv.id; editingTitle = conv.title || ''; }}
											class="p-2 md:p-0"
											title="Rename"
											aria-label="Rename conversation"
										>
											<Pencil class="h-3 w-3 text-slate-600 hover:text-accent-primary" />
										</button>
										<button
											onclick={(e) => { e.stopPropagation(); confirmDeleteId = conv.id; }}
											class="p-2 md:p-0"
											title="Delete"
											aria-label="Delete conversation"
										>
											<Trash2 class="h-3 w-3 text-slate-600 hover:text-red-400" />
										</button>
									</div>
								{/if}
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Chat area — per-agent session wash + accent (muted rainbow, keyed by agent id) -->
		<div
			class="flex min-h-0 min-w-0 flex-1 flex-col border-l-2"
			style="background: {sessionColor.bg}; border-left-color: {sessionColor.accent}; padding-bottom: {keyboardInset}px;"
		>
			<!-- Session header -->
			<div
				class="flex items-center justify-between gap-2 border-b px-3 py-2"
				style="background: {sessionColor.accent}26; border-bottom-color: {sessionColor.accent}59;"
			>
				<div class="flex min-w-0 items-center gap-2">
					<span class="h-2 w-2 shrink-0 rounded-full" style="background: {sessionColor.accent};"></span>
					<!-- Agent switcher: rebinds the active conversation to the chosen agent. -->
					<Select.Root type="single" value={activeAgentId} onValueChange={(v) => v && handleAgentChange(v)}>
						<Select.Trigger
							class="flex h-6 max-w-[10rem] items-center gap-1.5 border border-white/10 bg-white/[0.06] px-1.5 py-0 text-xs font-medium tracking-wide text-slate-100 hover:bg-white/[0.12]"
							title="Switch which agent you're talking with"
						>
							<img src={avatarSrc} alt={agentName} onerror={(e) => { const t = e.currentTarget as HTMLImageElement; t.onerror = null; t.src = FALLBACK_AVATAR; }} class="h-4 w-4 shrink-0 object-cover" />
							<span class="truncate">{agentName}</span>
						</Select.Trigger>
						<Select.Content style="border-color: {sessionColor.accent}59; background: #0b0d14; color: #e5e7eb;">
							{#each AGENTS as a (a.key)}
								<Select.Item value={a.key} label={a.name} class="text-xs">
									<span class="flex flex-col gap-0.5 py-0.5">
										<span class="flex items-center gap-2">
											<span class="h-2 w-2 shrink-0 rounded-full" style="background: {colorForAgent(a.key).accent};"></span>
											<span class="font-medium text-slate-100">{a.name}</span>
											<span class="text-slate-500">— {agentMeta(a.key).role}</span>
										</span>
										<span class="pl-4 text-[10px] text-slate-500">
											{agentMeta(a.key).defaultModel} · {agentMeta(a.key).stack}
										</span>
									</span>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="flex min-w-0 items-center gap-2.5 text-[10px] text-slate-200">
					<span class="flex min-w-0 items-center gap-1" title="Model for this session">
						<Cpu class="h-3 w-3 shrink-0" style="color: {sessionColor.accent};" />
						<Select.Root type="single" value={bifrost.model} onValueChange={(v) => setModel(v)}>
							<Select.Trigger
								class="flex h-5 max-w-[9rem] items-center gap-1 border border-white/10 bg-white/[0.07] px-1.5 py-0 font-mono text-[10px] text-slate-100 hover:bg-white/[0.12]"
								title="Switch the model for this session"
							>
								<span class="truncate">{selectedModelLabel}</span>
							</Select.Trigger>
							<Select.Content style="border-color: {sessionColor.accent}59; background: #0b0d14; color: #e5e7eb;">
								{#each bifrost.availableModels as m (m.id)}
									<Select.Item value={m.id} label={m.label} disabled={m.available === false} class="font-mono text-[11px]">
										{m.label}{m.free && m.id !== 'auto' ? ' · free' : ''}{m.available === false ? ' (no key)' : ''}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						{#if bifrost.model === 'auto' && currentModel && currentModel !== 'auto'}
							<span class="hidden shrink-0 truncate font-mono text-slate-400 sm:inline" title="Resolved by the tier ladder">→ {currentModel}</span>
						{/if}
					</span>
					{#if bifrost.contextTokens != null && bifrost.contextLimit}
						<span class="hidden shrink-0 items-center gap-1 md:flex" title="Context used this turn — switch session or compact when it fills">
							<span class="font-mono text-slate-300">{formatTokenCount(bifrost.contextTokens)}/{formatTokenCount(bifrost.contextLimit)}</span>
							<span class="block h-1 w-10 bg-white/10">
								<span class="block h-full" style="width: {contextPct}%; background: {barColor(contextPct ?? 0)};"></span>
							</span>
						</span>
					{/if}
					<!-- Context-fill warning pill (≥75% amber, ≥90% red). -->
					{#if contextWarning && contextPct != null}
						<button
							onclick={runCompaction}
							disabled={!canCompact || compacting}
							class="flex shrink-0 items-center gap-1 border px-1.5 py-0.5 font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
							style="background: {contextWarning.bg}; border-color: {contextWarning.border}; color: {contextWarning.text};"
							title={canCompact ? 'Context is filling — condense earlier turns to reclaim room' : 'Context is filling — start a new chat to reclaim room'}
							transition:fade={{ duration: 150 }}
						>
							<Scissors class="h-2.5 w-2.5" />
							<span>Context {contextPct}%</span>
						</button>
					{/if}
					{#if budgetPct !== null}
						<span class="flex shrink-0 items-center gap-1" title="Daily token budget: {formatTokenCount(bifrost.dailyTokens)} of {formatTokenCount(bifrost.dailyLimit ?? 0)} used">
							<span class="hidden font-mono text-slate-300 sm:inline">{formatTokenCount(bifrost.dailyTokens)}/{formatTokenCount(bifrost.dailyLimit ?? 0)}</span>
							<span class="block h-1 w-10 bg-white/10">
								<span class="block h-full" style="width: {budgetPct}%; background: {barColor(budgetPct)};"></span>
							</span>
						</span>
					{/if}
					<!-- Compact (/compact): condense earlier turns into a summary. -->
					<button
						onclick={runCompaction}
						disabled={!canCompact || compacting}
						class="shrink-0 p-1 text-slate-500 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
						title="Compact — condense earlier turns into a summary (/compact)"
						aria-label="Compact conversation"
					>
						{#if compacting}
							<Loader2 class="h-3 w-3 animate-spin" />
						{:else}
							<Scissors class="h-3 w-3" />
						{/if}
					</button>
					<!-- Tool reference (/help): what this agent can do. -->
					<button
						onclick={() => (showTools = true)}
						class="shrink-0 p-1 text-slate-500 transition-colors hover:text-slate-200"
						title="{agentName}'s tools (/help)"
						aria-label="Show agent tools"
					>
						<Wrench class="h-3 w-3" />
					</button>
					<button
						onclick={copyConversationLog}
						disabled={bifrost.activeMessages.length === 0}
						class="shrink-0 p-1 text-slate-500 transition-colors hover:text-slate-200 disabled:opacity-30"
						title="Copy conversation to clipboard"
						aria-label="Copy conversation"
					>
						{#if copied}
							<ClipboardCheck class="h-3 w-3 text-emerald-400" />
						{:else}
							<Copy class="h-3 w-3" />
						{/if}
					</button>
					<!-- App-like fullscreen toggle: hides the dashboard chrome. -->
					<button
						onclick={toggleChatFullscreen}
						class="shrink-0 p-1 text-slate-500 transition-colors hover:text-slate-200"
						title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen chat'}
						aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen chat'}
						aria-pressed={isFullscreen}
					>
						{#if isFullscreen}
							<Minimize2 class="h-3 w-3" />
						{:else}
							<Maximize2 class="h-3 w-3" />
						{/if}
					</button>
				</div>
			</div>
			<!-- Mobile toggle for conversation sidebar -->
			{#if isMobile}
				<div class="flex items-center gap-2 border-b border-slate-800 px-3 py-1.5">
					{#if isFullscreen}
						<button
							onclick={toggleChatFullscreen}
							class="flex items-center border border-slate-700 bg-slate-800 p-2.5 text-slate-300 transition hover:text-accent-primary"
							title="Exit fullscreen"
							aria-label="Exit fullscreen"
						>
							<Minimize2 class="h-3.5 w-3.5" />
						</button>
					{/if}
					<button
						onclick={() => (showMobileSidebar = true)}
						class="flex items-center gap-1.5 border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-300 transition hover:text-accent-primary md:px-2.5 md:py-1 md:text-xs"
					>
						<PanelLeftOpen class="h-3.5 w-3.5" />
						Chats
					</button>
					<div class="flex items-center gap-1" title={statusConfig.text}>
						<span class="h-1.5 w-1.5 rounded-full {statusConfig.color}"></span>
						<span class="text-[10px] text-slate-500">{statusConfig.text}</span>
					</div>
				</div>
			{/if}

			{#if showOfflineMessage}
				<div class="flex flex-1 items-center justify-center">
					<div class="text-center">
						<WifiOff class="mx-auto mb-3 h-8 w-8 text-slate-700" />
						<p class="mb-1 text-sm text-slate-400">{agentName} is offline</p>
						<p class="mb-3 text-xs text-slate-600">Waiting for daemon connection...</p>
						<button
							onclick={handleRetry}
							class="inline-flex items-center gap-1.5 bg-accent-primary px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:opacity-90"
						>
							<RefreshCw class="h-3 w-3" />
							Retry
						</button>
					</div>
				</div>
			{:else if !bifrost.activeConversationId}
				<div class="flex flex-1 items-center justify-center">
					<div class="text-center">
						<MessageSquare class="mx-auto mb-3 h-8 w-8 text-slate-700" />
						<p class="mb-1 text-sm text-slate-400">Start a conversation</p>
						<p class="mb-3 text-xs text-slate-600">Create a new chat to talk with {agentName}</p>
						<button
							onclick={handleNewChat}
							disabled={bifrost.connectionStatus !== 'connected'}
							class="inline-flex items-center gap-1.5 bg-accent-primary px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<Plus class="h-3 w-3" />
							New Chat
						</button>
					</div>
				</div>
			{:else}
				<!-- Messages area -->
				<div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
				<div
					bind:this={messagesContainer}
					onscroll={updatePinned}
					role="log"
					aria-live="polite"
					aria-relevant="additions text"
					aria-label="Conversation with {agentName}"
					class="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-2"
				>
					{#if bifrost.activeMessages.length === 0 && !bifrost.streaming}
						<div class="flex h-full items-center justify-center">
							<p class="text-xs text-slate-600">Send a message to begin</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each displayMessages as msg (msg.id)}
								{#if editingMessageId === msg.id}
									<!-- Inline edit-and-resend of a user turn. -->
									<div class="flex flex-col items-end gap-1">
										<textarea
											value={editingMessageText}
											oninput={(e) => (editingMessageText = e.currentTarget.value)}
											onkeydown={(e) => {
												if (e.key === 'Escape') cancelEditMessage();
												else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditMessage(); }
											}}
											use:focusOnMount
											rows={2}
											class="w-full max-w-[90%] resize-none border border-accent-primary bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none md:max-w-[75%]"
										></textarea>
										<div class="flex gap-1">
											<button onclick={cancelEditMessage} class="border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 transition hover:text-accent-primary">Cancel</button>
											<button onclick={commitEditMessage} class="bg-accent-primary px-2 py-0.5 text-[11px] font-medium text-slate-950 transition hover:opacity-90">Save &amp; resend</button>
										</div>
									</div>
								{:else}
									<div class="group/msg flex flex-col {msg.role === 'user' ? 'items-end' : 'items-start'}">
										{#if msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length}
											<div class="w-full max-w-full">
												{#each msg.tool_calls as tc}
													<ToolActivity
														name={(tc as { name: string }).name}
														params={(tc as { input?: Record<string, unknown> }).input ?? {}}
														status="done"
														durationMs={(tc as { durationMs?: number }).durationMs}
													/>
												{/each}
											</div>
										{/if}
										<ChatMessage role={msg.role as 'user' | 'assistant'} content={msg.content} />
										{#if msg.role === 'user' && !bifrost.streaming}
											<button
												onclick={() => startEditMessage(msg.id, msg.content)}
												class="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-slate-600 opacity-0 transition-opacity hover:text-accent-primary group-hover/msg:opacity-100"
												title="Edit and resend"
											>
												<Pencil class="h-2.5 w-2.5" /> Edit
											</button>
										{/if}
									</div>
								{/if}
							{/each}
							{#if bifrost.streaming && bifrost.streamingToolCalls.length}
								<div class="w-full max-w-full">
									{#each bifrost.streamingToolCalls as tc}
										<ToolActivity
											name={tc.name}
											params={tc.params}
											status={tc.status}
											startedAt={tc.startedAt}
											endedAt={tc.endedAt}
										/>
									{/each}
								</div>
							{/if}
							{#if bifrost.streaming && bifrost.streamingContent}
								<ChatMessage role="assistant" content={bifrost.streamingContent} isStreaming={true} />
							{/if}
							{#if bifrost.streaming && !bifrost.streamingContent}
								<div class="flex items-center gap-2 text-slate-500" role="status">
									<Loader2 class="h-4 w-4 animate-spin" />
									<span class="text-xs">{thinkingPhrase || `${agentName} is thinking…`}</span>
								</div>
							{/if}
							{#if bifrost.compactionNotice}
								<!-- Subtle marker that earlier turns were folded into a summary. -->
								<div class="my-2 flex items-center gap-2 px-2" transition:fade={{ duration: 150 }}>
									<span class="h-px flex-1 bg-slate-700/60"></span>
									<span class="shrink-0 text-[10px] tracking-wide text-slate-500">— Earlier turns compacted into a summary —</span>
									<span class="h-px flex-1 bg-slate-700/60"></span>
									<button
										onclick={dismissCompactionNotice}
										class="shrink-0 text-slate-600 transition-colors hover:text-slate-400"
										title="Dismiss"
										aria-label="Dismiss compaction notice"
									>
										<X class="h-2.5 w-2.5" />
									</button>
								</div>
							{/if}
							{#if canRegenerate}
								<div class="flex justify-start">
									<button
										onclick={() => regenerateLast()}
										class="flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-800 hover:text-accent-primary"
										title="Regenerate {agentName}'s last reply"
									>
										<RefreshCw class="h-3 w-3" /> Regenerate
									</button>
								</div>
							{/if}
						</div>
					{/if}

					{#if bifrost.lastError}
						<div class="mt-3 {bifrost.lastError.partial ? 'bg-amber-500/10 border border-amber-500/40' : 'bg-red-500/10 border border-red-500/40'} px-3 py-2" transition:fade={{ duration: 150 }}>
							<p class="text-xs {bifrost.lastError.partial ? 'text-amber-400' : 'text-red-400'}">
								{bifrost.lastError.message}
							</p>
							{#if bifrost.lastError.partial}
								<p class="mt-0.5 text-[10px] text-slate-500">Partial response shown above</p>
							{/if}
						</div>
					{/if}
				</div>

					<!-- Jump to latest — shown only when the user has scrolled up. -->
					{#if !pinned}
						<button
							onclick={jumpToLatest}
							class="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 bg-accent-primary px-3 py-1 text-xs font-medium text-slate-950 shadow-lg transition hover:opacity-90"
							transition:fade={{ duration: 120 }}
						>
							Jump to latest ↓
						</button>
					{/if}
				</div>

				<!-- Soft daily-budget warning (informational; daemon does not hard-block). -->
				{#if bifrost.budgetWarning}
					{@const bw = bifrost.budgetWarning}
					<div
						class="border-t px-4 py-2 text-[11px] {bw.fraction >= 1
							? 'border-red-600/30 bg-red-600/10 text-red-300'
							: 'border-amber-600/30 bg-amber-600/10 text-amber-300'}"
						transition:fade={{ duration: 150 }}
					>
						{bw.message}
					</div>
				{/if}

				<!-- Input area -->
				<div
					class="border-t border-slate-800 px-4 pt-2 pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] md:pb-9"
					style={keyboardInset > 0 || isFullscreen ? 'padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));' : ''}
				>
					<div class="flex items-end gap-2">
						<textarea
							bind:this={textareaEl}
							bind:value={inputValue}
							oninput={resizeTextarea}
							onkeydown={handleKeydown}
							onfocus={() => {
								setTimeout(() => textareaEl?.scrollIntoView({ block: 'nearest' }), 300);
							}}
							placeholder={bifrost.connectionStatus !== 'connected' ? 'Waiting for connection...' : `Message ${agentName}...`}
							rows={1}
							disabled={bifrost.streaming || bifrost.connectionStatus !== 'connected'}
							class="flex-1 resize-none border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none disabled:opacity-50 md:text-sm"
						></textarea>
						{#if bifrost.streaming}
							<button
								onclick={handleCancelStream}
								class="border border-red-500/40 bg-red-500/10 p-3 text-red-300 transition hover:bg-red-500/20 md:p-2"
								title="Cancel"
							>
								<Loader2 class="h-4 w-4 animate-spin" />
							</button>
						{:else}
							<button
								onclick={handleSend}
								disabled={!canSend}
								class="bg-accent-primary p-3 text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 md:p-2"
							>
								<Send class="h-4 w-4" />
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#if showTools}
		<ChatToolsPanel
			supabase={supabase}
			agent={activeAgentId}
			agentName={agentName}
			onClose={() => (showTools = false)}
		/>
	{/if}
</section>
{/if}

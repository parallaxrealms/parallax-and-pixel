<script lang="ts">
	/**
	 * Admin Email tab — transactional email activity from Resend.
	 * Reads public.email_logs (populated by /api/webhooks/resend). Admin-RLS gated.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import { Mail, RefreshCw, Search, AlertCircle, Loader2 } from 'lucide-svelte';

	let { supabase } = $props<{ supabase: SupabaseClient }>();

	type EmailLog = {
		id: string;
		email_id: string;
		from_addr: string | null;
		to_addr: string | null;
		subject: string | null;
		status: string | null;
		last_event: string | null;
		error: string | null;
		sent_at: string | null;
		delivered_at: string | null;
		bounced_at: string | null;
		complained_at: string | null;
		last_event_at: string | null;
		created_at: string;
	};

	let logs = $state<EmailLog[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let statusFilter = $state<string>('all');
	let search = $state('');

	const STATUS_FILTERS = [
		'all',
		'sent',
		'delivered',
		'delivery_delayed',
		'bounced',
		'complained',
		'failed'
	];

	async function load() {
		loading = true;
		loadError = null;
		try {
			const { data, error } = await supabase
				.from('email_logs')
				.select(
					'id, email_id, from_addr, to_addr, subject, status, last_event, error, sent_at, delivered_at, bounced_at, complained_at, last_event_at, created_at'
				)
				.order('created_at', { ascending: false })
				.limit(300);
			if (error) {
				loadError = error.message;
				return;
			}
			logs = (data as EmailLog[]) ?? [];
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load email activity.';
		} finally {
			loading = false;
		}
	}

	const filtered = $derived(
		logs.filter((l) => {
			if (statusFilter !== 'all' && l.status !== statusFilter) return false;
			const q = search.trim().toLowerCase();
			if (!q) return true;
			return (
				(l.to_addr ?? '').toLowerCase().includes(q) ||
				(l.subject ?? '').toLowerCase().includes(q) ||
				(l.from_addr ?? '').toLowerCase().includes(q)
			);
		})
	);

	const counts = $derived({
		total: logs.length,
		bounced: logs.filter((l) => l.status === 'bounced').length,
		complained: logs.filter((l) => l.status === 'complained').length
	});

	function statusClass(s: string | null): string {
		switch (s) {
			case 'delivered':
				return 'bg-emerald-500/15 text-emerald-400';
			case 'sent':
				return 'bg-accent-primary/20 text-accent-primary';
			case 'delivery_delayed':
				return 'bg-amber-500/15 text-amber-400';
			case 'opened':
			case 'clicked':
				return 'bg-slate-600/40 text-slate-300';
			case 'bounced':
			case 'complained':
			case 'failed':
				return 'bg-red-500/15 text-red-400';
			default:
				return 'bg-slate-700 text-slate-300';
		}
	}

	function fmt(iso: string | null): string {
		if (!iso) return '—';
		try {
			return new Date(iso).toLocaleString(undefined, {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return iso;
		}
	}

	onMount(load);
</script>

<div class="mx-auto max-w-6xl">
	<header class="mb-6 flex items-center gap-3">
		<Mail class="h-6 w-6 text-accent-primary" />
		<div>
			<h1 class="text-2xl font-bold text-white">Email</h1>
			<p class="mt-0.5 text-sm text-slate-400">
				Transactional email activity from Resend.
				{#if counts.total}
					<span class="text-slate-500"
						>· {counts.total} logged{#if counts.bounced || counts.complained}
							· <span class="text-red-400">{counts.bounced} bounced, {counts.complained} complaints</span
							>{/if}</span
					>
				{/if}
			</p>
		</div>
	</header>

	<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
		<div class="relative flex-1">
			<Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
			<input
				type="text"
				bind:value={search}
				placeholder="Search recipient / subject / sender…"
				class="w-full border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
			/>
		</div>
		<select
			bind:value={statusFilter}
			class="border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
		>
			{#each STATUS_FILTERS as s (s)}
				<option value={s}>{s === 'all' ? 'All statuses' : s.replace('_', ' ')}</option>
			{/each}
		</select>
		<button
			onclick={load}
			class="flex items-center justify-center gap-1.5 border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 transition hover:text-accent-primary"
		>
			<RefreshCw class="h-3.5 w-3.5" /> Refresh
		</button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else if loadError}
		<div class="flex items-start gap-2 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
			<div>
				{loadError}
				<div class="mt-1 text-xs text-red-400/80">
					If the <code>email_logs</code> table doesn't exist yet, apply
					<code>ref/migrations/005_email_logs.sql</code> in Supabase.
				</div>
			</div>
		</div>
	{:else if logs.length === 0}
		<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500">
			No email activity yet. Once the Resend webhook
			(<code class="text-slate-400">/api/webhooks/resend</code>) is configured and email is sent,
			events will appear here.
		</div>
	{:else}
		<div class="overflow-hidden border border-slate-800">
			<table class="w-full text-left text-sm">
				<thead class="bg-slate-900 text-xs uppercase tracking-wider text-slate-500">
					<tr>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium">To</th>
						<th class="px-4 py-3 font-medium">Subject</th>
						<th class="hidden px-4 py-3 font-medium lg:table-cell">From</th>
						<th class="px-4 py-3 font-medium">Last event</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800">
					{#each filtered as l (l.id)}
						<tr class="bg-slate-950 align-top hover:bg-slate-900/60">
							<td class="px-4 py-3">
								<span class="inline-block px-2 py-0.5 text-xs font-medium {statusClass(l.status)}">
									{(l.status ?? 'unknown').replace('_', ' ')}
								</span>
								{#if l.error}
									<div class="mt-1 max-w-[220px] truncate text-xs text-red-400" title={l.error}>{l.error}</div>
								{/if}
							</td>
							<td class="max-w-[200px] truncate px-4 py-3 text-slate-200" title={l.to_addr ?? ''}>{l.to_addr ?? '—'}</td>
							<td class="max-w-[260px] truncate px-4 py-3 text-slate-300" title={l.subject ?? ''}>{l.subject ?? '—'}</td>
							<td class="hidden max-w-[180px] truncate px-4 py-3 text-slate-500 lg:table-cell" title={l.from_addr ?? ''}>{l.from_addr ?? '—'}</td>
							<td class="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmt(l.last_event_at ?? l.created_at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if filtered.length === 0}
			<p class="mt-3 text-center text-sm text-slate-600">No emails match the current filter.</p>
		{/if}
	{/if}
</div>

<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { BankTransactionHistoryEntry } from '$lib/types/finances';
	import { Clock, Loader2 } from 'lucide-svelte';
	import { browser } from '$app/environment';

	interface Props {
		supabase: SupabaseClient;
		transactionId: string;
	}

	let { supabase, transactionId }: Props = $props();

	let history = $state<BankTransactionHistoryEntry[]>([]);
	let isLoading = $state(true);

	const ACTION_LABELS: Record<string, string> = {
		created: 'Created',
		updated: 'Updated',
		reviewed: 'Marked reviewed',
		unreviewed: 'Unmarked review',
		matched: 'Matched',
		excluded: 'Excluded',
		attachment_added: 'Attachment added',
		attachment_removed: 'Attachment removed'
	};

	const ACTION_COLORS: Record<string, string> = {
		created: 'text-accent-primary',
		updated: 'text-slate-300',
		reviewed: 'text-emerald-400',
		unreviewed: 'text-amber-400',
		matched: 'text-accent-primary',
		excluded: 'text-slate-500',
		attachment_added: 'text-slate-300',
		attachment_removed: 'text-red-300'
	};

	function formatTime(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function getChangesSummary(changes: Record<string, { old: unknown; new: unknown }> | null): string {
		if (!changes) return '';
		const parts: string[] = [];
		for (const [field, val] of Object.entries(changes)) {
			if (field === 'source' || field === 'import_id') continue;
			if (field === 'file_name') {
				if (val.new) parts.push(`"${val.new}"`);
				else if (val.old) parts.push(`"${val.old}"`);
			} else {
				parts.push(`${field}: ${val.old ?? '(none)'} → ${val.new ?? '(none)'}`);
			}
		}
		return parts.join(', ');
	}

	async function loadHistory() {
		if (!browser || !supabase) return;
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('bank_transaction_history')
				.select('*')
				.eq('transaction_id', transactionId)
				.order('created_at', { ascending: false });

			if (error) throw error;
			history = data || [];
		} catch {
			// silent
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (transactionId) loadHistory();
	});
</script>

<div class="space-y-2">
	<div class="flex items-center gap-2">
		<Clock class="h-4 w-4 text-slate-400" />
		<span class="text-sm font-medium text-slate-300">History</span>
	</div>

	{#if isLoading}
		<div class="flex items-center gap-2 py-2">
			<Loader2 class="h-4 w-4 animate-spin text-slate-500" />
			<span class="text-xs text-slate-500">Loading...</span>
		</div>
	{:else if history.length === 0}
		<p class="text-xs text-slate-500">No history yet</p>
	{:else}
		<div class="space-y-1.5 text-xs">
			{#each history as entry (entry.id)}
				<div class="flex items-start gap-2">
					<div class="mt-0.5 h-1.5 w-1.5 shrink-0 bg-slate-600"></div>
					<div class="flex-1">
						<span class={ACTION_COLORS[entry.action] || 'text-slate-300'}>
							{ACTION_LABELS[entry.action] || entry.action}
						</span>
						{#if getChangesSummary(entry.changes)}
							<span class="text-slate-500"> - {getChangesSummary(entry.changes)}</span>
						{/if}
						<span class="ml-1 text-slate-600">{formatTime(entry.created_at)}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

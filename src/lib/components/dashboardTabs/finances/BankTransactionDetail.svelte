<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { BankTransaction, BankTransactionType } from '$lib/types/finances';
	import { getFinanceCategoryNames } from '$lib/stores/financeCategories.svelte';
	import { Check, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import BankTransactionAttachments from './BankTransactionAttachments.svelte';
	import BankTransactionHistory from './BankTransactionHistory.svelte';

	// NOTE: the legacy `finances` ledger is NOT part of this port. The
	// "Link to Finances" auto-create behavior from 9realms has been removed —
	// markReviewed is now a pure status toggle (reviewed <-> unreviewed).

	interface Props {
		supabase: SupabaseClient;
		transaction: BankTransaction;
		readOnly?: boolean;
		onUpdate?: (updated: BankTransaction) => void;
	}

	let { supabase, transaction, readOnly = false, onUpdate }: Props = $props();

	// svelte-ignore state_referenced_locally
	let notes = $state(transaction.notes || '');
	// svelte-ignore state_referenced_locally
	let type = $state<BankTransactionType | null>(transaction.type);
	// svelte-ignore state_referenced_locally
	let category = $state(transaction.category || '');
	let isSaving = $state(false);
	let financeCategories = $derived(getFinanceCategoryNames());

	$effect(() => {
		notes = transaction.notes || '';
		type = transaction.type;
		category = transaction.category || '';
	});

	async function saveField(field: string, value: unknown) {
		if (readOnly) return;
		isSaving = true;
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const oldValue = (transaction as unknown as Record<string, unknown>)[field];
			if (oldValue === value) {
				isSaving = false;
				return;
			}

			const { data, error } = await supabase
				.from('bank_transactions')
				.update({
					[field]: value || null,
					updated_at: new Date().toISOString(),
					updated_by: user.id
				})
				.eq('id', transaction.id)
				.select()
				.single();

			if (error) throw error;

			await supabase.from('bank_transaction_history').insert({
				transaction_id: transaction.id,
				user_id: user.id,
				action: 'updated',
				changes: { [field]: { old: oldValue, new: value || null } }
			});

			onUpdate?.(data);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to save');
		} finally {
			isSaving = false;
		}
	}

	async function markReviewed() {
		if (readOnly) return;
		isSaving = true;
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const isReviewing = transaction.status === 'unreviewed' || transaction.status === 'excluded';
			const newStatus = isReviewing ? 'reviewed' : 'unreviewed';

			const updatePayload: Record<string, unknown> = {
				status: newStatus,
				updated_at: new Date().toISOString(),
				updated_by: user.id
			};

			if (isReviewing) {
				updatePayload.reviewed_by = user.id;
				updatePayload.reviewed_at = new Date().toISOString();
			} else {
				updatePayload.reviewed_by = null;
				updatePayload.reviewed_at = null;
			}

			const { data, error } = await supabase
				.from('bank_transactions')
				.update(updatePayload)
				.eq('id', transaction.id)
				.select()
				.single();

			if (error) throw error;

			await supabase.from('bank_transaction_history').insert({
				transaction_id: transaction.id,
				user_id: user.id,
				action: isReviewing ? 'reviewed' : 'unreviewed',
				changes: { status: { old: transaction.status, new: data.status } }
			});

			onUpdate?.(data);
			toast.success(isReviewing ? 'Marked as reviewed' : 'Review removed');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update');
		} finally {
			isSaving = false;
		}
	}

	async function markExcluded() {
		if (readOnly) return;
		isSaving = true;
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const { data, error } = await supabase
				.from('bank_transactions')
				.update({
					status: 'excluded',
					updated_at: new Date().toISOString(),
					updated_by: user.id
				})
				.eq('id', transaction.id)
				.select()
				.single();

			if (error) throw error;

			await supabase.from('bank_transaction_history').insert({
				transaction_id: transaction.id,
				user_id: user.id,
				action: 'excluded',
				changes: { status: { old: transaction.status, new: 'excluded' } }
			});

			onUpdate?.(data);
			toast.success('Transaction excluded');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to exclude');
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="border-t border-slate-700 bg-slate-800/30 p-4">
	<div class="grid gap-4 lg:grid-cols-3">
		<!-- Left: Details + Controls -->
		<div class="space-y-4 lg:col-span-2">
			<!-- Full description + reference -->
			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<span class="block text-xs text-slate-500">Full Description</span>
					<p class="mt-1 text-sm text-slate-300">{transaction.description}</p>
				</div>
				{#if transaction.reference_number}
					<div>
						<span class="block text-xs text-slate-500">Reference</span>
						<p class="mt-1 text-sm text-slate-400">{transaction.reference_number}</p>
					</div>
				{/if}
			</div>

			<!-- Type + Category -->
			{#if !readOnly}
				<div class="grid gap-3 sm:grid-cols-2">
					<div>
						<label for="detail-type-{transaction.id}" class="block text-xs text-slate-500">Type</label>
						<select
							id="detail-type-{transaction.id}"
							bind:value={type}
							onchange={() => saveField('type', type || null)}
							class="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white focus:border-accent-primary focus:outline-none"
						>
							<option value={null}>Unset</option>
							<option value="income">Income</option>
							<option value="expense">Expense</option>
							<option value="transfer">Transfer</option>
						</select>
					</div>

					<div>
						<label for="detail-cat-{transaction.id}" class="block text-xs text-slate-500">Category</label>
						<select
							id="detail-cat-{transaction.id}"
							bind:value={category}
							onchange={() => saveField('category', category || null)}
							class="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white focus:border-accent-primary focus:outline-none"
						>
							<option value="">Uncategorized</option>
							{#each financeCategories as cat (cat)}
								<option value={cat}>{cat}</option>
							{/each}
						</select>
					</div>
				</div>
			{/if}

			<!-- Notes -->
			<div>
				<span class="block text-xs text-slate-500">Notes</span>
				{#if readOnly}
					<p class="mt-1 text-sm text-slate-400">{notes || 'No notes'}</p>
				{:else}
					<textarea
						bind:value={notes}
						onblur={() => saveField('notes', notes)}
						rows={2}
						placeholder="Add notes..."
						class="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
					></textarea>
				{/if}
			</div>

			<!-- Action Buttons -->
			{#if !readOnly}
				<div class="flex items-center gap-2 pt-2">
					{#if transaction.status === 'unreviewed' || transaction.status === 'excluded'}
						<button
							onclick={markReviewed}
							disabled={isSaving}
							class="flex items-center gap-1 bg-accent-primary px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
						>
							<Check class="h-4 w-4" /> Mark Reviewed
						</button>
					{:else}
						<button
							onclick={markReviewed}
							disabled={isSaving}
							class="border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
						>
							Undo Review
						</button>
					{/if}

					{#if transaction.status !== 'excluded'}
						<button
							onclick={markExcluded}
							disabled={isSaving}
							class="flex items-center gap-1 border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
						>
							<X class="h-4 w-4" /> Exclude
						</button>
					{/if}
				</div>
			{/if}

			<!-- Raw Data (collapsible) -->
			{#if transaction.raw_data}
				<details class="text-xs">
					<summary class="cursor-pointer text-slate-500 hover:text-slate-400">Raw CSV Data</summary>
					<pre class="mt-1 max-h-32 overflow-auto bg-slate-950 p-2 text-slate-400">{JSON.stringify(transaction.raw_data, null, 2)}</pre>
				</details>
			{/if}
		</div>

		<!-- Right: Attachments + History -->
		<div class="space-y-4 border-l border-slate-700 pl-4">
			<BankTransactionAttachments {supabase} transactionId={transaction.id} {readOnly} />
			<BankTransactionHistory {supabase} transactionId={transaction.id} />
		</div>
	</div>
</div>

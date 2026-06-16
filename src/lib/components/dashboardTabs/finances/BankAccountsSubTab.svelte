<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import type { BankAccount, BankAccountType } from '$lib/types/finances';
	import {
		Building2,
		User,
		Users,
		Plus,
		Edit,
		Trash2,
		CreditCard,
		ArrowRightLeft,
		Loader2,
		X
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		supabase: SupabaseClient;
		onViewTransactions?: (account: BankAccount) => void;
	}

	let { supabase, onViewTransactions }: Props = $props();

	let accounts = $state<BankAccount[]>([]);
	let isLoading = $state(true);
	let isDialogOpen = $state(false);
	let editingAccount = $state<BankAccount | null>(null);
	let saving = $state(false);
	let deleteDialogOpen = $state(false);
	let accountToDelete = $state<BankAccount | null>(null);

	let form = $state({
		name: '',
		account_type: 'personal' as BankAccountType,
		shared: false,
		institution_name: '',
		account_number_last4: '',
		currency: 'USD',
		notes: ''
	});

	async function loadAccounts() {
		if (!browser || !supabase) return;
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('bank_accounts')
				.select('*')
				.order('created_at', { ascending: true });

			if (error) throw error;
			accounts = data || [];
		} catch (err) {
			console.error('Failed to load bank accounts:', err);
			toast.error('Failed to load bank accounts');
		} finally {
			isLoading = false;
		}
	}

	function resetForm() {
		form = {
			name: '',
			account_type: 'personal',
			shared: false,
			institution_name: '',
			account_number_last4: '',
			currency: 'USD',
			notes: ''
		};
	}

	function openAdd() {
		resetForm();
		editingAccount = null;
		isDialogOpen = true;
	}

	function openEdit(account: BankAccount) {
		editingAccount = account;
		form = {
			name: account.name,
			account_type: account.account_type,
			shared: account.shared,
			institution_name: account.institution_name || '',
			account_number_last4: account.account_number_last4 || '',
			currency: account.currency,
			notes: account.notes || ''
		};
		isDialogOpen = true;
	}

	async function saveAccount() {
		saving = true;
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const payload = {
				name: form.name,
				account_type: form.account_type,
				shared: form.shared,
				institution_name: form.institution_name || null,
				account_number_last4: form.account_number_last4 || null,
				currency: form.currency,
				notes: form.notes || null,
				updated_at: new Date().toISOString()
			};

			if (editingAccount) {
				const { error } = await supabase
					.from('bank_accounts')
					.update(payload)
					.eq('id', editingAccount.id);
				if (error) throw error;
				toast.success('Account updated');
			} else {
				const { error } = await supabase
					.from('bank_accounts')
					.insert({ ...payload, owner_id: user.id, created_by: user.id });
				if (error) throw error;
				toast.success('Account created');
			}

			isDialogOpen = false;
			editingAccount = null;
			resetForm();
			await loadAccounts();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to save account');
		} finally {
			saving = false;
		}
	}

	async function deleteAccount() {
		if (!accountToDelete) return;
		try {
			const { error } = await supabase.from('bank_accounts').delete().eq('id', accountToDelete.id);
			if (error) throw error;
			toast.success('Account deleted');
			accountToDelete = null;
			deleteDialogOpen = false;
			await loadAccounts();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete account');
		}
	}

	$effect(() => {
		if (browser && supabase) loadAccounts();
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold text-white">Bank Accounts</h2>
			<p class="text-sm text-slate-400">Manage accounts for bank statement reconciliation</p>
		</div>
		<button
			onclick={openAdd}
			class="flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
		>
			<Plus class="h-4 w-4" /> Add Account
		</button>
	</div>

	{#if isLoading}
		<div class="flex h-40 items-center justify-center">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else if accounts.length === 0}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<CreditCard class="mb-3 h-12 w-12 text-slate-600" />
			<p class="text-slate-400">No bank accounts yet</p>
			<p class="mt-1 text-sm text-slate-500">Add your accounts to start importing statements</p>
			<button
				onclick={openAdd}
				class="mt-4 flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
			>
				<Plus class="h-4 w-4" /> Add First Account
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-1">
			{#each accounts as account (account.id)}
				<div class="flex items-center gap-3 border border-slate-800 bg-slate-950 px-3 py-1.5 transition-colors hover:bg-slate-800/60">
					<div class="flex h-7 w-7 shrink-0 items-center justify-center {account.account_type === 'business' ? 'bg-accent-primary/20' : 'bg-slate-700'}">
						{#if account.account_type === 'business'}
							<Building2 class="h-4 w-4 text-accent-primary" />
						{:else if account.shared}
							<Users class="h-4 w-4 text-slate-300" />
						{:else}
							<User class="h-4 w-4 text-slate-300" />
						{/if}
					</div>

					<div class="flex min-w-0 flex-1 items-center gap-2">
						<span class="truncate text-sm font-semibold text-slate-100">{account.name}</span>
						{#if account.institution_name}
							<span class="truncate text-xs text-slate-400">{account.institution_name}</span>
						{/if}
						{#if account.notes}
							<span class="truncate text-xs text-slate-500">{account.notes}</span>
						{/if}
					</div>

					<div class="flex shrink-0 items-center gap-2 text-xs">
						<span class="bg-slate-700 px-1.5 py-0.5 text-[10px] capitalize text-slate-300">{account.account_type}</span>
						{#if account.shared}
							<span class="bg-accent-primary/15 px-1.5 py-0.5 text-[10px] text-accent-primary">Shared</span>
						{/if}
						{#if account.account_number_last4}
							<span class="bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">****{account.account_number_last4}</span>
						{/if}
						<span class="bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">{account.currency}</span>
					</div>

					<div class="flex shrink-0 items-center gap-1">
						<button
							onclick={() => onViewTransactions?.(account)}
							class="p-1 text-slate-500 hover:text-accent-primary"
							title="View transactions"
						>
							<ArrowRightLeft class="h-3.5 w-3.5" />
						</button>
						<button onclick={() => openEdit(account)} class="p-1 text-slate-500 hover:text-accent-primary" title="Edit">
							<Edit class="h-3.5 w-3.5" />
						</button>
						<button
							onclick={() => { accountToDelete = account; deleteDialogOpen = true; }}
							class="p-1 text-slate-500 hover:text-red-400"
							title="Delete"
						>
							<Trash2 class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Account Dialog -->
{#if isDialogOpen}
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={() => (isDialogOpen = false)}
	>
		<div
			role="presentation"
			class="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-slate-700 bg-slate-900 p-5"
			onclick={(ev) => ev.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-xl font-semibold text-white">{editingAccount ? 'Edit' : 'Add'} Bank Account</h3>
				<button onclick={() => (isDialogOpen = false)} class="text-slate-400 hover:text-white">
					<X class="h-5 w-5" />
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); saveAccount(); }} class="space-y-4">
				<div>
					<label for="acc-name" class="mb-1 block text-xs font-medium text-slate-400">Account Name *</label>
					<input
						id="acc-name"
						bind:value={form.name}
						required
						placeholder="e.g., Chase Personal"
						class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
					/>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="acc-type" class="mb-1 block text-xs font-medium text-slate-400">Type *</label>
						<select
							id="acc-type"
							bind:value={form.account_type}
							class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
						>
							<option value="personal">Personal</option>
							<option value="business">Business</option>
						</select>
					</div>
					<div>
						<label for="acc-currency" class="mb-1 block text-xs font-medium text-slate-400">Currency</label>
						<input
							id="acc-currency"
							bind:value={form.currency}
							placeholder="USD"
							class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="acc-inst" class="mb-1 block text-xs font-medium text-slate-400">Institution</label>
						<input
							id="acc-inst"
							bind:value={form.institution_name}
							placeholder="e.g., Chase Bank"
							class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
						/>
					</div>
					<div>
						<label for="acc-last4" class="mb-1 block text-xs font-medium text-slate-400">Last 4 Digits</label>
						<input
							id="acc-last4"
							bind:value={form.account_number_last4}
							maxlength={4}
							placeholder="1234"
							class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
						/>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<input
						type="checkbox"
						id="acc-shared"
						bind:checked={form.shared}
						class="h-4 w-4 border-slate-600 bg-slate-800 accent-[var(--accent-primary)]"
					/>
					<label for="acc-shared" class="text-sm text-slate-300">Shared account (all admins can edit transactions)</label>
				</div>

				<div>
					<label for="acc-notes" class="mb-1 block text-xs font-medium text-slate-400">Notes</label>
					<textarea
						id="acc-notes"
						bind:value={form.notes}
						rows={2}
						class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
					></textarea>
				</div>

				<div class="flex justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={() => (isDialogOpen = false)}
						class="border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={saving}
						class="flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
					>
						{#if saving}<Loader2 class="h-4 w-4 animate-spin" />{/if}
						{editingAccount ? 'Save Changes' : 'Create'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation -->
{#if deleteDialogOpen && accountToDelete}
	<div
		role="presentation"
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
		onclick={() => { deleteDialogOpen = false; accountToDelete = null; }}
	>
		<div
			role="presentation"
			class="max-h-[90vh] w-full max-w-md overflow-y-auto border border-slate-700 bg-slate-900 p-5"
			onclick={(ev) => ev.stopPropagation()}
		>
			<h3 class="text-xl font-semibold text-red-400">Delete Account</h3>
			<p class="mt-2 text-slate-300">
				Are you sure you want to delete <strong>{accountToDelete.name}</strong>? This will also delete
				all imported transactions and attachments for this account.
			</p>
			<div class="mt-5 flex justify-end gap-2">
				<button
					onclick={() => { deleteDialogOpen = false; accountToDelete = null; }}
					class="border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
				>
					Cancel
				</button>
				<button
					onclick={deleteAccount}
					class="border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
				>
					Delete Account
				</button>
			</div>
		</div>
	</div>
{/if}

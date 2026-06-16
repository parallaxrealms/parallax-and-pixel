<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import type {
		BankAccount,
		BankTransaction,
		BankTransactionStatus,
		BankTransactionType
	} from '$lib/types/finances';
	import { getFinanceCategoryNames, loadFinanceCategories } from '$lib/stores/financeCategories.svelte';
	import {
		ChevronLeft,
		ChevronRight,
		ChevronDown,
		ChevronUp,
		Check,
		X,
		Search,
		Upload,
		Loader2
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import BankTransactionDetail from './BankTransactionDetail.svelte';
	import FinanceCategoryManager from './FinanceCategoryManager.svelte';
	import { loadBillAliases, aliasFor, type AliasMap } from '$lib/utils/billMerchant';

	// All transactions flow through the Import sub-tab (CSV upload). This
	// component lists, filters, inline-edits (category/type), bulk-reviews, and
	// shows detail for imported transactions. Single-tenant: every admin can
	// edit (RLS gates the tables to admins) — no per-account read-only gating.

	interface Props {
		supabase: SupabaseClient;
		onGoToImport?: () => void;
	}

	let { supabase, onGoToImport }: Props = $props();

	let accounts = $state<BankAccount[]>([]);
	let transactions = $state<BankTransaction[]>([]);
	let billAliases = $state<AliasMap>(new Map());
	let isLoading = $state(true);

	// Filters
	let selectedAccountId = $state('');
	let currentMonth = $state(new Date().getMonth());
	let currentYear = $state(new Date().getFullYear());
	let statusFilter = $state<BankTransactionStatus | ''>('');
	let typeFilter = $state<BankTransactionType | ''>('');
	let categoryFilter = $state('');
	let searchQuery = $state('');

	// Selection
	let selectedIds = $state<Set<string>>(new Set());
	let expandedId = $state<string | null>(null);

	// Bulk action state
	let bulkCategory = $state('');
	let isBulkProcessing = $state(false);

	const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	async function loadAccounts() {
		if (!browser || !supabase) return;
		try {
			const { data, error } = await supabase.from('bank_accounts').select('*').order('name');
			if (error) throw error;
			accounts = data || [];
			if (accounts.length > 0 && !selectedAccountId) {
				selectedAccountId = accounts[0].id;
			}
		} catch (err) {
			console.error('Failed to load accounts:', err);
		}
	}

	async function loadTransactions() {
		if (!browser || !supabase || !selectedAccountId) return;
		isLoading = true;
		selectedIds = new Set();
		expandedId = null;

		try {
			const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
			const endDate = new Date(currentYear, currentMonth + 1, 0);
			const endDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

			const { data, error } = await supabase
				.from('bank_transactions')
				.select('*')
				.eq('account_id', selectedAccountId)
				.gte('date', startDate)
				.lte('date', endDateStr)
				.order('date', { ascending: false });

			if (error) throw error;
			transactions = data || [];
		} catch (err) {
			console.error('Failed to load transactions:', err);
			toast.error('Failed to load transactions');
		} finally {
			isLoading = false;
		}
	}

	let financeCategories = $derived(getFinanceCategoryNames());

	$effect(() => {
		if (browser && supabase) {
			loadAccounts();
			loadFinanceCategories(supabase);
			loadBillAliases(supabase).then((m) => (billAliases = m));
		}
	});

	$effect(() => {
		if (browser && supabase && selectedAccountId) {
			loadTransactions();
		}
	});

	function prevMonth() {
		if (currentMonth === 0) {
			currentMonth = 11;
			currentYear--;
		} else {
			currentMonth--;
		}
	}

	function nextMonth() {
		if (currentMonth === 11) {
			currentMonth = 0;
			currentYear++;
		} else {
			currentMonth++;
		}
	}

	let filteredTransactions = $derived.by(() => {
		let result = [...transactions];

		if (statusFilter) result = result.filter((t) => t.status === statusFilter);
		if (typeFilter) result = result.filter((t) => t.type === typeFilter);
		if (categoryFilter) result = result.filter((t) => t.category === categoryFilter);
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(t) =>
					t.description.toLowerCase().includes(q) ||
					t.notes?.toLowerCase().includes(q) ||
					t.reference_number?.toLowerCase().includes(q)
			);
		}

		return result;
	});

	let reviewedCount = $derived(transactions.filter((t) => t.status === 'reviewed' || t.status === 'matched').length);
	let unreviewedCount = $derived(transactions.filter((t) => t.status === 'unreviewed').length);
	let totalCount = $derived(transactions.length);
	let incomeTotal = $derived(transactions.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0));
	let expenseTotal = $derived(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0));
	let progressPercent = $derived(totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0);

	let selectedAccount = $derived(accounts.find((a) => a.id === selectedAccountId));

	let availableCategories = $derived.by(() => {
		const cats = new Set<string>();
		transactions.forEach((t) => {
			if (t.category) cats.add(t.category);
		});
		return Array.from(cats).sort();
	});

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleSelectAll() {
		if (selectedIds.size === filteredTransactions.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(filteredTransactions.map((t) => t.id));
		}
	}

	async function bulkMarkReviewed() {
		if (selectedIds.size === 0) return;
		isBulkProcessing = true;
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const ids = Array.from(selectedIds);
			const { error } = await supabase
				.from('bank_transactions')
				.update({
					status: 'reviewed',
					reviewed_by: user.id,
					reviewed_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					updated_by: user.id
				})
				.in('id', ids);

			if (error) throw error;

			const historyEntries = ids.map((id) => ({
				transaction_id: id,
				user_id: user.id,
				action: 'reviewed' as const,
				changes: { status: { old: 'unreviewed', new: 'reviewed' } }
			}));

			await supabase.from('bank_transaction_history').insert(historyEntries);

			toast.success(`Marked ${ids.length} transactions as reviewed`);
			selectedIds = new Set();
			await loadTransactions();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Bulk action failed');
		} finally {
			isBulkProcessing = false;
		}
	}

	async function bulkCategorize() {
		if (selectedIds.size === 0 || !bulkCategory) return;
		isBulkProcessing = true;
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const ids = Array.from(selectedIds);
			const { error } = await supabase
				.from('bank_transactions')
				.update({ category: bulkCategory, updated_at: new Date().toISOString(), updated_by: user.id })
				.in('id', ids);

			if (error) throw error;

			toast.success(`Categorized ${ids.length} transactions as "${bulkCategory}"`);
			selectedIds = new Set();
			bulkCategory = '';
			await loadTransactions();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Bulk categorize failed');
		} finally {
			isBulkProcessing = false;
		}
	}

	async function bulkExclude() {
		if (selectedIds.size === 0) return;
		isBulkProcessing = true;
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const ids = Array.from(selectedIds);
			const { error } = await supabase
				.from('bank_transactions')
				.update({ status: 'excluded', updated_at: new Date().toISOString(), updated_by: user.id })
				.in('id', ids);

			if (error) throw error;

			toast.success(`Excluded ${ids.length} transactions`);
			selectedIds = new Set();
			await loadTransactions();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Bulk exclude failed');
		} finally {
			isBulkProcessing = false;
		}
	}

	async function inlineCategoryChange(txn: BankTransaction, newCategory: string) {
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) return;

			const { error } = await supabase
				.from('bank_transactions')
				.update({ category: newCategory || null, updated_at: new Date().toISOString(), updated_by: user.id })
				.eq('id', txn.id);

			if (error) throw error;

			const idx = transactions.findIndex((t) => t.id === txn.id);
			if (idx >= 0) {
				transactions[idx] = { ...transactions[idx], category: newCategory || null };
			}
		} catch {
			toast.error('Failed to update category');
		}
	}

	async function inlineTypeChange(txn: BankTransaction, newType: string) {
		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) return;

			const { error } = await supabase
				.from('bank_transactions')
				.update({ type: newType || null, updated_at: new Date().toISOString(), updated_by: user.id })
				.eq('id', txn.id);

			if (error) throw error;

			const idx = transactions.findIndex((t) => t.id === txn.id);
			if (idx >= 0) {
				transactions[idx] = { ...transactions[idx], type: (newType as BankTransactionType) || null };
			}
		} catch {
			toast.error('Failed to update type');
		}
	}

	function handleTransactionUpdate(updated: BankTransaction) {
		const idx = transactions.findIndex((t) => t.id === updated.id);
		if (idx >= 0) {
			transactions[idx] = updated;
		}
	}

	function getStatusColor(status: BankTransactionStatus): string {
		switch (status) {
			case 'unreviewed':
				return 'bg-amber-400';
			case 'reviewed':
				return 'bg-emerald-400';
			case 'matched':
				return 'bg-accent-primary';
			case 'excluded':
				return 'bg-slate-500';
			default:
				return 'bg-slate-500';
		}
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<div class="space-y-4">
	<!-- Top bar: Account selector + Month picker + Progress -->
	<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
		<select
			bind:value={selectedAccountId}
			class="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none sm:w-56"
		>
			{#if accounts.length === 0}
				<option value="">No accounts</option>
			{/if}
			{#each accounts as acc (acc.id)}
				<option value={acc.id}>{acc.name}{acc.account_type === 'business' ? ' (Business)' : ''}</option>
			{/each}
		</select>

		<div class="flex items-center gap-1">
			<button onclick={prevMonth} class="p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200" aria-label="Previous month">
				<ChevronLeft class="h-4 w-4" />
			</button>
			<span class="min-w-[140px] text-center text-sm font-medium text-slate-200">
				{MONTHS[currentMonth]} {currentYear}
			</span>
			<button onclick={nextMonth} class="p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200" aria-label="Next month">
				<ChevronRight class="h-4 w-4" />
			</button>
		</div>

		<div class="flex flex-1 items-center gap-3">
			<div class="h-2 flex-1 overflow-hidden bg-slate-700">
				<div class="h-full bg-emerald-500 transition-all" style="width: {progressPercent}%"></div>
			</div>
			<span class="whitespace-nowrap text-xs text-slate-400">{reviewedCount}/{totalCount} reviewed ({progressPercent}%)</span>
		</div>
	</div>

	<!-- Summary Cards -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
		<div class="border border-slate-800 bg-slate-950 p-3 text-center">
			<p class="text-lg font-bold text-slate-200">{totalCount}</p>
			<p class="text-xs text-slate-500">Total</p>
		</div>
		<div class="border border-slate-800 bg-slate-950 p-3 text-center">
			<p class="text-lg font-bold text-emerald-400">{reviewedCount}</p>
			<p class="text-xs text-slate-500">Reviewed</p>
		</div>
		<div class="border border-slate-800 bg-slate-950 p-3 text-center">
			<p class="text-lg font-bold text-amber-400">{unreviewedCount}</p>
			<p class="text-xs text-slate-500">Unreviewed</p>
		</div>
		<div class="border border-slate-800 bg-slate-950 p-3 text-center">
			<p class="text-lg font-bold text-emerald-400">{formatCurrency(incomeTotal)}</p>
			<p class="text-xs text-slate-500">Income</p>
		</div>
		<div class="border border-slate-800 bg-slate-950 p-3 text-center">
			<p class="text-lg font-bold text-red-400">{formatCurrency(expenseTotal)}</p>
			<p class="text-xs text-slate-500">Expenses</p>
		</div>
	</div>

	<!-- Filter bar -->
	<div class="flex flex-wrap items-center gap-2">
		<div class="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
			<Search class="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
			<input
				placeholder="Search descriptions..."
				bind:value={searchQuery}
				class="w-full border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-accent-primary focus:outline-none"
			/>
		</div>

		<select
			bind:value={statusFilter}
			class="w-36 border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
		>
			<option value="">All Status</option>
			<option value="unreviewed">Unreviewed</option>
			<option value="reviewed">Reviewed</option>
			<option value="matched">Matched</option>
			<option value="excluded">Excluded</option>
		</select>

		<select
			bind:value={typeFilter}
			class="w-32 border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
		>
			<option value="">All Types</option>
			<option value="income">Income</option>
			<option value="expense">Expense</option>
			<option value="transfer">Transfer</option>
		</select>

		{#if availableCategories.length > 0}
			<select
				bind:value={categoryFilter}
				class="w-40 border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white focus:border-accent-primary focus:outline-none"
			>
				<option value="">All Categories</option>
				{#each availableCategories as cat (cat)}
					<option value={cat}>{cat}</option>
				{/each}
			</select>
		{/if}

		<FinanceCategoryManager {supabase} />
	</div>

	<!-- Bulk Actions Bar -->
	{#if selectedIds.size > 0}
		<div class="flex flex-wrap items-center gap-3 border border-accent-primary/30 bg-accent-primary/10 p-3">
			<span class="text-sm text-accent-primary">{selectedIds.size} selected</span>

			<select
				bind:value={bulkCategory}
				class="w-44 border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white focus:border-accent-primary focus:outline-none"
			>
				<option value="">Set category...</option>
				{#each financeCategories as cat (cat)}
					<option value={cat}>{cat}</option>
				{/each}
			</select>
			{#if bulkCategory}
				<button
					onclick={bulkCategorize}
					disabled={isBulkProcessing}
					class="border border-accent-primary px-3 py-1.5 text-sm text-accent-primary transition hover:bg-accent-primary/10 disabled:opacity-60"
				>
					Apply Category
				</button>
			{/if}

			<button
				onclick={bulkMarkReviewed}
				disabled={isBulkProcessing}
				class="flex items-center gap-1 bg-accent-primary px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
			>
				<Check class="h-3.5 w-3.5" /> Mark Reviewed
			</button>

			<button
				onclick={bulkExclude}
				disabled={isBulkProcessing}
				class="flex items-center gap-1 border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
			>
				<X class="h-3.5 w-3.5" /> Exclude
			</button>

			<button onclick={() => (selectedIds = new Set())} class="ml-auto text-xs text-slate-400 hover:text-slate-200">
				Clear selection
			</button>
		</div>
	{/if}

	<!-- Transaction List -->
	{#if isLoading}
		<div class="flex h-40 items-center justify-center">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else if !selectedAccountId}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<p class="text-slate-400">Select an account to view transactions</p>
		</div>
	{:else if filteredTransactions.length === 0}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<Upload class="mb-3 h-10 w-10 text-slate-600" />
			<p class="text-slate-400">No transactions found for {MONTHS[currentMonth]} {currentYear}</p>
			<p class="mt-1 text-sm text-slate-500">Transactions are imported from bank CSVs. Use Import to add transactions.</p>
			<button
				onclick={() => onGoToImport?.()}
				class="mt-4 flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
			>
				<Upload class="h-4 w-4" /> Go to Import
			</button>
		</div>
	{:else}
		<div class="overflow-x-auto border border-slate-800">
			<!-- Header row -->
			<div class="flex min-w-[560px] items-center gap-2 border-b border-slate-700 px-3 py-2 text-xs font-medium text-slate-500 lg:min-w-[720px]">
				<input
					type="checkbox"
					checked={selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0}
					onchange={toggleSelectAll}
					class="h-3.5 w-3.5 accent-[var(--accent-primary)]"
				/>
				<span class="w-16">Date</span>
				<span class="flex-1">Description</span>
				<span class="w-24 text-right">Amount</span>
				<span class="hidden w-36 sm:block">Category</span>
				<span class="hidden w-24 lg:block">Type</span>
				<span class="w-5"></span>
				<span class="w-6"></span>
			</div>

			<!-- Transaction rows -->
			<div class="max-h-[600px] divide-y divide-slate-800 overflow-y-auto">
				{#each filteredTransactions as txn (txn.id)}
					{@const isExpanded = expandedId === txn.id}
					{@const txAlias = aliasFor(txn.description, billAliases)}
					<div>
						<!-- Compact row -->
						<div class="flex min-w-[560px] items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-slate-700/20 lg:min-w-[720px] {txn.status === 'excluded' ? 'opacity-50' : ''}">
							<input
								type="checkbox"
								checked={selectedIds.has(txn.id)}
								onchange={() => toggleSelect(txn.id)}
								class="h-3.5 w-3.5 accent-[var(--accent-primary)]"
							/>

							<span class="w-16 text-xs text-slate-400">{formatDate(txn.date)}</span>

							<span class="min-w-0 flex-1 truncate text-slate-300" title={txn.description}>
								{txn.description}{#if txAlias}<span class="ml-2 text-slate-500" title={txAlias}>· {txAlias}</span>{/if}
							</span>

							<span class="w-24 text-right font-mono font-semibold {txn.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}">
								{txn.amount >= 0 ? '+' : ''}{formatCurrency(txn.amount)}
							</span>

							<!-- Category (inline) -->
							<div class="hidden w-36 sm:block">
								<select
									value={txn.category || ''}
									onchange={(e) => inlineCategoryChange(txn, (e.currentTarget as HTMLSelectElement).value)}
									class="w-full border-0 bg-transparent px-1 py-0.5 text-xs text-slate-300 hover:bg-slate-700 focus:outline-none"
								>
									<option value="">Categorize...</option>
									{#each financeCategories as cat (cat)}
										<option value={cat}>{cat}</option>
									{/each}
								</select>
							</div>

							<!-- Type (inline) -->
							<div class="hidden w-24 lg:block">
								<select
									value={txn.type || ''}
									onchange={(e) => inlineTypeChange(txn, (e.currentTarget as HTMLSelectElement).value)}
									class="w-full border-0 bg-transparent px-1 py-0.5 text-xs hover:bg-slate-700 focus:outline-none {txn.type === 'income' ? 'text-emerald-400' : txn.type === 'expense' ? 'text-red-400' : txn.type === 'transfer' ? 'text-accent-primary' : 'text-slate-500'}"
								>
									<option value="">type...</option>
									<option value="income">income</option>
									<option value="expense">expense</option>
									<option value="transfer">transfer</option>
								</select>
							</div>

							<!-- Status dot -->
							<div class="flex w-5 justify-center" title={txn.status}>
								<div class="h-2.5 w-2.5 {getStatusColor(txn.status)}"></div>
							</div>

							<!-- Expand -->
							<button
								onclick={() => (expandedId = isExpanded ? null : txn.id)}
								class="w-6 p-0.5 text-slate-400 hover:text-slate-200"
								aria-label={isExpanded ? 'Collapse' : 'Expand'}
							>
								{#if isExpanded}
									<ChevronUp class="h-4 w-4" />
								{:else}
									<ChevronDown class="h-4 w-4" />
								{/if}
							</button>
						</div>

						{#if isExpanded}
							<BankTransactionDetail {supabase} transaction={txn} onUpdate={handleTransactionUpdate} />
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

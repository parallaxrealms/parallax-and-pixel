<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { DollarSign, CreditCard, ArrowRightLeft, Upload, Receipt, Landmark } from 'lucide-svelte';
	import FinancesOverviewSubTab from './FinancesOverviewSubTab.svelte';
	import BankAccountsSubTab from './BankAccountsSubTab.svelte';
	import BankTransactionsSubTab from './BankTransactionsSubTab.svelte';
	import BankImportSubTab from './BankImportSubTab.svelte';
	import BillsSubTab from './BillsSubTab.svelte';

	type SubTab = 'overview' | 'bills' | 'accounts' | 'transactions' | 'import';

	interface Props {
		supabase: SupabaseClient;
		initialSubTab?: SubTab;
	}

	let { supabase, initialSubTab = 'overview' }: Props = $props();

	// svelte-ignore state_referenced_locally
	let activeSubTab = $state<SubTab>(initialSubTab);

	const subTabs = [
		{ id: 'overview' as const, label: 'Overview', icon: DollarSign },
		{ id: 'bills' as const, label: 'Bills', icon: Receipt },
		{ id: 'accounts' as const, label: 'Bank Accounts', icon: CreditCard },
		{ id: 'transactions' as const, label: 'Transactions', icon: ArrowRightLeft },
		{ id: 'import' as const, label: 'Import', icon: Upload }
	];
</script>

<div class="mx-auto max-w-6xl">
	<!-- Header -->
	<header class="mb-6 flex items-center gap-3">
		<Landmark class="h-6 w-6 text-accent-primary" />
		<div>
			<h1 class="text-2xl font-bold text-white">Finances</h1>
			<p class="mt-0.5 text-sm text-slate-400">Financial overview & bank reconciliation</p>
		</div>
	</header>

	<!-- Sub-Tab Navigation -->
	<div class="mb-6 flex overflow-x-auto border-b border-slate-700">
		{#each subTabs as tab (tab.id)}
			{@const Icon = tab.icon}
			<button
				onclick={() => (activeSubTab = tab.id)}
				class="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors
					{activeSubTab === tab.id
					? 'border-b-2 border-accent-primary text-accent-primary'
					: 'text-slate-400 hover:text-slate-300'}"
			>
				<Icon class="h-4 w-4" />
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Sub-Tab Content -->
	{#if activeSubTab === 'overview'}
		<FinancesOverviewSubTab
			{supabase}
			onGoToImport={() => (activeSubTab = 'import')}
			onGoToTransactions={() => (activeSubTab = 'transactions')}
			onGoToBills={() => (activeSubTab = 'bills')}
		/>
	{:else if activeSubTab === 'bills'}
		<BillsSubTab {supabase} />
	{:else if activeSubTab === 'accounts'}
		<BankAccountsSubTab {supabase} onViewTransactions={() => (activeSubTab = 'transactions')} />
	{:else if activeSubTab === 'transactions'}
		<BankTransactionsSubTab {supabase} onGoToImport={() => (activeSubTab = 'import')} />
	{:else if activeSubTab === 'import'}
		<BankImportSubTab {supabase} onImportComplete={() => (activeSubTab = 'transactions')} />
	{/if}
</div>

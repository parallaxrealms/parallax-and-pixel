<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import {
		TrendingUp,
		TrendingDown,
		DollarSign,
		Receipt,
		ArrowRightLeft,
		Upload,
		PieChart,
		CalendarClock,
		ArrowUpRight,
		ArrowDownRight,
		Loader2
	} from 'lucide-svelte';
	import { normalizeMerchant, prettyMerchant, loadBillAliases, type AliasMap } from '$lib/utils/billMerchant';

	// Overview derives ALL stats from `bank_transactions` only. The legacy
	// `finances` ledger and `invoices` tables are NOT part of this port, so:
	//   - income/expense/net come from the current month's transactions
	//   - category breakdown comes from current-month expenses
	//   - "upcoming bills" are detected from recurring bank transactions
	//     (same heuristic as the Bills sub-tab), not a recurring-finances table.

	interface Props {
		supabase: SupabaseClient;
		onGoToImport?: () => void;
		onGoToTransactions?: () => void;
		onGoToBills?: () => void;
	}

	let { supabase, onGoToImport, onGoToTransactions, onGoToBills }: Props = $props();

	type BankTxn = {
		id: string;
		date: string;
		description: string;
		amount: number;
		category: string | null;
		status: string;
		type: string | null;
	};

	const LOOKBACK_MONTHS = 6;
	const MIN_MONTHS_SEEN = 3;
	const MAX_AMOUNT_CV = 0.35;

	let isLoading = $state(true);
	let monthTxns = $state<BankTxn[]>([]);
	let recentTxns = $state<BankTxn[]>([]);
	// Transactions across the lookback window for bill detection.
	let windowTxns = $state<BankTxn[]>([]);
	let aliases = $state<AliasMap>(new Map());

	function monthBounds() {
		const now = new Date();
		const start = new Date(now.getFullYear(), now.getMonth(), 1);
		const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		const fmt = (d: Date) => d.toISOString().split('T')[0];
		return { start: fmt(start), end: fmt(end) };
	}

	async function loadData() {
		if (!browser || !supabase) return;
		isLoading = true;
		try {
			const { start, end } = monthBounds();
			const horizon = new Date();
			horizon.setMonth(horizon.getMonth() - (LOOKBACK_MONTHS + 1));
			const sinceIso = horizon.toISOString().slice(0, 10);

			const [monthRes, recentRes, windowRes, aliasMap] = await Promise.all([
				supabase
					.from('bank_transactions')
					.select('id,date,description,amount,category,status,type')
					.gte('date', start)
					.lte('date', end)
					.neq('status', 'excluded'),
				supabase
					.from('bank_transactions')
					.select('id,date,description,amount,category,status,type')
					.neq('status', 'excluded')
					.order('date', { ascending: false })
					.limit(10),
				supabase
					.from('bank_transactions')
					.select('id,date,description,amount,category,status,type')
					.gte('date', sinceIso)
					.neq('status', 'excluded')
					.order('date', { ascending: false })
					.limit(5000),
				loadBillAliases(supabase)
			]);

			if (monthRes.error) throw monthRes.error;
			if (recentRes.error) throw recentRes.error;
			if (windowRes.error) throw windowRes.error;

			monthTxns = monthRes.data || [];
			recentTxns = recentRes.data || [];
			windowTxns = windowRes.data || [];
			aliases = aliasMap;
		} catch (err) {
			console.error('Failed to load finance overview:', err);
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (browser && supabase) {
			loadData();
		}
	});

	let totalIncome = $derived(
		monthTxns.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0)
	);
	let totalExpense = $derived(
		monthTxns.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
	);
	let netBalance = $derived(totalIncome - totalExpense);

	let categoryBreakdown = $derived.by(() => {
		const breakdown: Record<string, number> = {};
		monthTxns
			.filter((t) => Number(t.amount) < 0)
			.forEach((t) => {
				const cat = t.category || 'Uncategorized';
				breakdown[cat] = (breakdown[cat] || 0) + Math.abs(Number(t.amount));
			});
		return Object.entries(breakdown)
			.map(([name, amount]) => ({ name, amount }))
			.sort((a, b) => b.amount - a.amount)
			.slice(0, 6);
	});

	// Upcoming bills derived from recurring bank transactions: detect recurring
	// merchants over the lookback window, project the typical day into the next
	// 30 days. (Replaces the legacy recurring-finances table.)
	type UpcomingBill = { id: string; title: string; amount: number; dueDate: string; daysUntil: number };

	let upcomingBills = $derived.by<UpcomingBill[]>(() => {
		const now = new Date();
		const windowStart = new Date(now.getFullYear(), now.getMonth() - LOOKBACK_MONTHS + 1, 1);

		const groups = new Map<string, BankTxn[]>();
		for (const t of windowTxns) {
			if (!t.description) continue;
			const isExpense = Number(t.amount) < 0 || t.type === 'expense';
			if (!isExpense) continue;
			if (new Date(t.date) < windowStart) continue;
			const key = normalizeMerchant(t.description);
			if (!key) continue;
			const arr = groups.get(key) ?? [];
			arr.push(t);
			groups.set(key, arr);
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const horizon = new Date(today);
		horizon.setDate(horizon.getDate() + 30);

		const result: UpcomingBill[] = [];
		for (const [key, txs] of groups) {
			const distinctMonths = new Set(
				txs.map((t) => {
					const d = new Date(t.date);
					return `${d.getFullYear()}-${d.getMonth()}`;
				})
			);
			if (distinctMonths.size < MIN_MONTHS_SEEN) continue;

			const amounts = txs.map((t) => Math.abs(Number(t.amount)));
			const mean = amounts.reduce((s, n) => s + n, 0) / amounts.length;
			if (mean <= 0) continue;
			const variance = amounts.reduce((s, n) => s + (n - mean) ** 2, 0) / amounts.length;
			const cv = Math.sqrt(variance) / mean;
			if (cv > MAX_AMOUNT_CV) continue;

			const days = txs.map((t) => new Date(t.date).getDate());
			const typicalDay = Math.round(days.reduce((s, n) => s + n, 0) / days.length);

			// Project the typical day into this month, then next month.
			let candidate: Date | null = null;
			for (let offset = 0; offset < 2 && !candidate; offset++) {
				const year = today.getFullYear();
				const month = today.getMonth() + offset;
				const daysInMonth = new Date(year, month + 1, 0).getDate();
				const d = new Date(year, month, Math.min(typicalDay, daysInMonth));
				if (d >= today && d <= horizon) candidate = d;
			}
			if (!candidate) continue;

			const alias = aliases.get(key);
			const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
			const daysUntil = Math.round((candidate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
			result.push({
				id: key,
				title: alias ?? prettyMerchant(sorted[0].description),
				amount: mean,
				dueDate: candidate.toISOString().split('T')[0],
				daysUntil
			});
		}

		return result.sort((a, b) => a.daysUntil - b.daysUntil);
	});

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function formatShortDate(dateStr: string): string {
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	let monthLabel = $derived(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
</script>

{#if isLoading}
	<div class="flex h-[50vh] items-center justify-center">
		<Loader2 class="h-6 w-6 animate-spin text-slate-500" />
	</div>
{:else}
	<div class="space-y-6">
		<!-- Quick Actions -->
		<div class="flex flex-wrap items-center gap-2">
			<button onclick={() => onGoToImport?.()} class="flex items-center gap-1.5 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90">
				<Upload class="h-4 w-4" /> Import Transactions
			</button>
			<button onclick={() => onGoToTransactions?.()} class="flex items-center gap-1.5 border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
				<ArrowRightLeft class="h-4 w-4" /> View All Transactions
			</button>
			<button onclick={() => onGoToBills?.()} class="flex items-center gap-1.5 border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
				<Receipt class="h-4 w-4" /> Manage Bills
			</button>
		</div>

		<!-- This Month at a Glance -->
		<div>
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">This Month at a Glance</h3>
				<span class="text-xs text-slate-500">{monthLabel}</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div class="border border-emerald-500/30 bg-slate-800/50 p-4">
					<div class="flex h-10 w-10 items-center justify-center bg-emerald-500/20">
						<TrendingUp class="h-5 w-5 text-emerald-400" />
					</div>
					<p class="mt-3 text-2xl font-bold text-emerald-400">{formatCurrency(totalIncome)}</p>
					<p class="text-sm text-slate-400">Income</p>
				</div>

				<div class="border border-red-500/30 bg-slate-800/50 p-4">
					<div class="flex h-10 w-10 items-center justify-center bg-red-500/20">
						<TrendingDown class="h-5 w-5 text-red-400" />
					</div>
					<p class="mt-3 text-2xl font-bold text-red-400">{formatCurrency(totalExpense)}</p>
					<p class="text-sm text-slate-400">Expenses</p>
				</div>

				<div class="border border-slate-800 bg-slate-950 p-4">
					<div class="flex h-10 w-10 items-center justify-center bg-slate-700">
						<DollarSign class="h-5 w-5 text-slate-300" />
					</div>
					<p class="mt-3 text-2xl font-bold {netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}">{formatCurrency(netBalance)}</p>
					<p class="text-sm text-slate-400">Net</p>
				</div>
			</div>

			{#if monthTxns.length === 0}
				<div class="mt-3 border border-slate-800 bg-slate-900/50 p-4 text-center text-sm text-slate-500">
					No transactions imported for {monthLabel} yet. Use
					<button class="text-accent-primary underline hover:opacity-90" onclick={() => onGoToImport?.()}>Import</button>
					to bring in bank CSVs.
				</div>
			{/if}
		</div>

		<!-- Two-column: Upcoming Bills + Category Breakdown -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Upcoming Bills -->
			<div class="border border-slate-800 bg-slate-950">
				<div class="flex items-center justify-between border-b border-slate-700 p-4">
					<div class="flex items-center gap-2">
						<CalendarClock class="h-4 w-4 text-slate-400" />
						<h3 class="text-sm font-semibold text-slate-200">Upcoming Bills</h3>
						<span class="text-xs text-slate-500">(next 30 days)</span>
					</div>
					<button class="text-xs text-accent-primary hover:opacity-90" onclick={() => onGoToBills?.()}>View all</button>
				</div>

				{#if upcomingBills.length === 0}
					<div class="flex flex-col items-center justify-center py-10 text-center">
						<Receipt class="mb-2 h-8 w-8 text-slate-600" />
						<p class="text-sm text-slate-500">No bills due in the next 30 days</p>
					</div>
				{:else}
					<div class="divide-y divide-slate-800">
						{#each upcomingBills as bill (bill.id)}
							<div class="flex items-center gap-3 px-4 py-3">
								<div class="flex min-w-[44px] flex-col items-center justify-center">
									<span class="text-xs font-semibold {bill.daysUntil <= 3 ? 'text-red-400' : bill.daysUntil <= 7 ? 'text-amber-400' : 'text-slate-400'}">
										{bill.daysUntil === 0 ? 'Today' : `${bill.daysUntil}d`}
									</span>
									<span class="text-[10px] text-slate-500">{formatShortDate(bill.dueDate)}</span>
								</div>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-slate-200">{bill.title}</p>
								</div>
								<span class="font-mono text-sm font-semibold text-red-400">{formatCurrency(bill.amount)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Category Breakdown -->
			<div class="border border-slate-800 bg-slate-950">
				<div class="flex items-center justify-between border-b border-slate-700 p-4">
					<div class="flex items-center gap-2">
						<PieChart class="h-4 w-4 text-slate-400" />
						<h3 class="text-sm font-semibold text-slate-200">Top Spend Categories</h3>
					</div>
					<span class="text-xs text-slate-500">{monthLabel}</span>
				</div>

				{#if categoryBreakdown.length === 0}
					<div class="flex flex-col items-center justify-center py-10 text-center">
						<PieChart class="mb-2 h-8 w-8 text-slate-600" />
						<p class="text-sm text-slate-500">No expense data this month</p>
					</div>
				{:else}
					<div class="space-y-3 p-4">
						{#each categoryBreakdown as cat (cat.name)}
							{@const pct = totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0}
							<div>
								<div class="mb-1 flex items-center justify-between text-sm">
									<span class="truncate text-slate-300">{cat.name}</span>
									<span class="font-mono text-slate-400">{formatCurrency(cat.amount)}</span>
								</div>
								<div class="h-1.5 w-full bg-slate-800">
									<div class="h-1.5 bg-accent-primary" style="width: {pct}%"></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Recent Transactions -->
		<div class="border border-slate-800 bg-slate-950">
			<div class="flex items-center justify-between border-b border-slate-700 p-4">
				<div class="flex items-center gap-2">
					<ArrowRightLeft class="h-4 w-4 text-slate-400" />
					<h3 class="text-sm font-semibold text-slate-200">Recent Transactions</h3>
				</div>
				<button class="text-xs text-accent-primary hover:opacity-90" onclick={() => onGoToTransactions?.()}>View all</button>
			</div>

			{#if recentTxns.length === 0}
				<div class="flex flex-col items-center justify-center py-10 text-center">
					<Upload class="mb-2 h-8 w-8 text-slate-600" />
					<p class="text-sm text-slate-500">No transactions yet</p>
					<p class="mt-1 text-xs text-slate-600">Transactions are imported from bank CSVs.</p>
					<button onclick={() => onGoToImport?.()} class="mt-3 flex items-center gap-1.5 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90">
						<Upload class="h-4 w-4" /> Import Transactions
					</button>
				</div>
			{:else}
				<div class="divide-y divide-slate-800">
					{#each recentTxns as txn (txn.id)}
						<div class="flex items-center gap-3 px-4 py-2.5 text-sm">
							<div class="flex h-7 w-7 items-center justify-center {Number(txn.amount) >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}">
								{#if Number(txn.amount) >= 0}
									<ArrowUpRight class="h-3.5 w-3.5 text-emerald-400" />
								{:else}
									<ArrowDownRight class="h-3.5 w-3.5 text-red-400" />
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-slate-200" title={txn.description}>{txn.description}</p>
								<div class="flex items-center gap-2 text-xs text-slate-500">
									<span>{formatShortDate(txn.date)}</span>
									{#if txn.category}
										<span class="bg-slate-800 px-1.5 py-0.5">{txn.category}</span>
									{/if}
								</div>
							</div>
							<span class="font-mono text-sm font-semibold {Number(txn.amount) >= 0 ? 'text-emerald-400' : 'text-red-400'}">
								{Number(txn.amount) >= 0 ? '+' : ''}{formatCurrency(Number(txn.amount))}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import type { BankTransaction } from '$lib/types/finances';
	import { ChevronLeft, ChevronRight, Receipt, AlertCircle, Pencil, Check, X } from 'lucide-svelte';
	import {
		normalizeMerchant,
		prettyMerchant,
		loadBillAliases,
		upsertBillAlias,
		deleteBillAlias,
		type AliasMap
	} from '$lib/utils/billMerchant';

	let { supabase } = $props<{ supabase: SupabaseClient }>();

	const LOOKBACK_MONTHS = 6;
	const MIN_MONTHS_SEEN = 3;
	const MAX_AMOUNT_CV = 0.35;

	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let transactions = $state<BankTransaction[]>([]);
	let aliases = $state<AliasMap>(new Map());
	let currentMonth = $state(new Date());

	let editingKey = $state<string | null>(null);
	let editValue = $state('');
	let savingKey = $state<string | null>(null);

	function prevMonth() {
		const d = new Date(currentMonth);
		d.setMonth(d.getMonth() - 1);
		currentMonth = d;
	}

	function nextMonth() {
		const d = new Date(currentMonth);
		d.setMonth(d.getMonth() + 1);
		currentMonth = d;
	}

	let monthLabel = $derived(currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

	let isCurrentMonth = $derived(() => {
		const now = new Date();
		return currentMonth.getMonth() === now.getMonth() && currentMonth.getFullYear() === now.getFullYear();
	});

	type RecurringBill = {
		key: string;
		merchant: string;
		isCustomTitle: boolean;
		sampleDescription: string;
		avgAmount: number;
		monthsSeen: number;
		typicalDay: number;
		firstSeen: string;
		lastSeen: string;
		thisMonth: BankTransaction | null;
	};

	let recurringBills = $derived.by<RecurringBill[]>(() => {
		const year = currentMonth.getFullYear();
		const month = currentMonth.getMonth();
		const monthStart = new Date(year, month, 1);
		const monthEnd = new Date(year, month + 1, 0);

		const now = new Date();
		const windowStart = new Date(now.getFullYear(), now.getMonth() - LOOKBACK_MONTHS + 1, 1);

		const groups = new Map<string, BankTransaction[]>();
		for (const t of transactions) {
			if (!t.description) continue;
			if (t.status === 'excluded') continue;
			const isExpense = t.amount < 0 || t.type === 'expense';
			if (!isExpense) continue;

			const txDate = new Date(t.date);
			if (txDate < windowStart) continue;

			const key = normalizeMerchant(t.description);
			if (!key) continue;
			const arr = groups.get(key) ?? [];
			arr.push(t);
			groups.set(key, arr);
		}

		const bills: RecurringBill[] = [];
		for (const [key, txs] of groups) {
			const distinctMonths = new Set(
				txs.map((t) => {
					const d = new Date(t.date);
					return `${d.getFullYear()}-${d.getMonth()}`;
				})
			);
			if (distinctMonths.size < MIN_MONTHS_SEEN) continue;

			const amounts = txs.map((t) => Math.abs(t.amount));
			const mean = amounts.reduce((s, n) => s + n, 0) / amounts.length;
			if (mean <= 0) continue;
			const variance = amounts.reduce((s, n) => s + (n - mean) ** 2, 0) / amounts.length;
			const stddev = Math.sqrt(variance);
			const cv = stddev / mean;
			if (cv > MAX_AMOUNT_CV) continue;

			const days = txs.map((t) => new Date(t.date).getDate());
			const typicalDay = Math.round(days.reduce((s, n) => s + n, 0) / days.length);

			const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
			const firstSeen = sorted[0].date;
			const lastSeen = sorted[sorted.length - 1].date;

			const thisMonth =
				txs.find((t) => {
					const d = new Date(t.date);
					return d >= monthStart && d <= monthEnd;
				}) ?? null;

			const firstSeenDate = new Date(firstSeen);
			const lastSeenDate = new Date(lastSeen);
			const graceEnd = new Date(lastSeenDate);
			graceEnd.setDate(graceEnd.getDate() + 35);
			const monthIsWithinLifespan = monthEnd >= firstSeenDate && monthStart <= graceEnd;
			if (!thisMonth && !monthIsWithinLifespan) continue;

			const alias = aliases.get(key);
			bills.push({
				key,
				merchant: alias ?? prettyMerchant(sorted[0].description),
				isCustomTitle: !!alias,
				sampleDescription: sorted[sorted.length - 1].description,
				avgAmount: mean,
				monthsSeen: distinctMonths.size,
				typicalDay,
				firstSeen,
				lastSeen,
				thisMonth
			});
		}

		return bills.sort((a, b) => a.typicalDay - b.typicalDay);
	});

	let totalMonthly = $derived(
		recurringBills.reduce((sum, b) => sum + (b.thisMonth ? Math.abs(b.thisMonth.amount) : b.avgAmount), 0)
	);

	let confirmedCount = $derived(recurringBills.filter((b) => b.thisMonth).length);

	function startEdit(bill: RecurringBill) {
		editingKey = bill.key;
		editValue = bill.merchant;
	}

	function cancelEdit() {
		editingKey = null;
		editValue = '';
	}

	async function saveEdit(bill: RecurringBill) {
		const trimmed = editValue.trim();
		if (!trimmed) {
			cancelEdit();
			return;
		}
		savingKey = bill.key;
		try {
			if (trimmed === prettyMerchant(bill.sampleDescription)) {
				await deleteBillAlias(supabase, bill.key);
				const next = new Map(aliases);
				next.delete(bill.key);
				aliases = next;
			} else {
				await upsertBillAlias(supabase, bill.key, trimmed);
				const next = new Map(aliases);
				next.set(bill.key, trimmed);
				aliases = next;
			}
			editingKey = null;
		} catch (err) {
			console.error('Failed to save bill alias:', err);
			loadError = err instanceof Error ? err.message : 'Failed to save title';
		} finally {
			savingKey = null;
		}
	}

	async function loadData() {
		isLoading = true;
		loadError = null;
		try {
			const horizon = new Date();
			horizon.setMonth(horizon.getMonth() - (LOOKBACK_MONTHS + 1));
			const sinceIso = horizon.toISOString().slice(0, 10);

			const [txRes, aliasMap] = await Promise.all([
				supabase
					.from('bank_transactions')
					.select('id, account_id, date, description, amount, status, type, category')
					.gte('date', sinceIso)
					.order('date', { ascending: false })
					.limit(5000),
				loadBillAliases(supabase)
			]);

			if (txRes.error) throw txRes.error;
			transactions = (txRes.data || []) as BankTransaction[];
			aliases = aliasMap;
		} catch (err) {
			const e = err as { message?: string };
			console.error('Failed to load bank transactions:', err);
			loadError = e?.message ?? 'Failed to load transactions';
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (browser && supabase) {
			loadData();
		}
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<Receipt class="h-5 w-5 text-accent-primary" />
			<div>
				<h3 class="text-lg font-semibold text-white">Recurring Bills</h3>
				<p class="text-xs text-slate-500">
					Auto-detected from bank transactions · {LOOKBACK_MONTHS}-month window · seen in {MIN_MONTHS_SEEN}+ months
				</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<button onclick={prevMonth} class="border border-slate-700 bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200" aria-label="Previous month">
				<ChevronLeft class="h-5 w-5" />
			</button>
			<span class="min-w-[180px] text-center text-sm font-medium text-slate-200">{monthLabel}</span>
			<button
				onclick={nextMonth}
				class="border border-slate-700 bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
				class:opacity-50={isCurrentMonth()}
				disabled={isCurrentMonth()}
				aria-label="Next month"
			>
				<ChevronRight class="h-5 w-5" />
			</button>
		</div>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12 text-slate-500">
			<div class="h-6 w-6 animate-spin border-2 border-accent-primary border-t-transparent"></div>
			<span class="ml-3">Scanning bank transactions...</span>
		</div>
	{:else if loadError}
		<div class="flex items-start gap-3 border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-300">
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
			<div>
				<div class="font-medium">Bills tab error</div>
				<div class="mt-1 text-xs text-red-400/80">{loadError}</div>
			</div>
		</div>
	{:else if recurringBills.length === 0}
		<div class="border border-slate-800 bg-slate-900/50 p-8 text-center">
			<Receipt class="mx-auto h-10 w-10 text-slate-600" />
			<p class="mt-3 text-sm text-slate-500">No recurring bills detected for {monthLabel}.</p>
			<p class="mt-1 text-xs text-slate-600">
				Import more bank statements under Import, or wait for the same merchant to appear in {MIN_MONTHS_SEEN}+ months.
			</p>
		</div>
	{:else}
		<!-- Mobile card list -->
		<div class="space-y-2 md:hidden">
			{#each recurringBills as bill (bill.key)}
				{@const amount = bill.thisMonth ? Math.abs(bill.thisMonth.amount) : bill.avgAmount}
				<div class="border border-slate-800 bg-slate-900/40 p-3">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							{#if editingKey === bill.key}
								<div class="flex items-center gap-1">
									<input
										type="text"
										bind:value={editValue}
										class="min-w-0 flex-1 border border-accent-primary bg-slate-950 px-2 py-1 text-sm text-white focus:outline-none"
										onkeydown={(e) => {
											if (e.key === 'Enter') saveEdit(bill);
											if (e.key === 'Escape') cancelEdit();
										}}
									/>
									<button onclick={() => saveEdit(bill)} disabled={savingKey === bill.key} class="p-1 text-emerald-400 hover:text-emerald-300">
										<Check class="h-4 w-4" />
									</button>
									<button onclick={cancelEdit} class="p-1 text-slate-500 hover:text-slate-300">
										<X class="h-4 w-4" />
									</button>
								</div>
							{:else}
								<div class="flex items-center gap-2">
									<div class="truncate font-medium {bill.isCustomTitle ? 'text-accent-primary' : 'text-slate-200'}">
										{bill.merchant}
									</div>
									<button onclick={() => startEdit(bill)} class="text-slate-500 hover:text-slate-300" aria-label="Edit bill title">
										<Pencil class="h-3.5 w-3.5" />
									</button>
								</div>
							{/if}
							<div class="mt-0.5 truncate text-xs text-slate-500">{bill.sampleDescription}</div>
						</div>
						<span class="shrink-0 font-mono text-sm font-medium text-red-400">${amount.toFixed(2)}</span>
					</div>
					<div class="mt-2 flex items-center gap-2">
						<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium {bill.thisMonth ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/40 text-slate-400'}">
							{bill.thisMonth ? 'Charged' : 'Expected'}
						</span>
						<span class="text-xs text-slate-500">~day {bill.typicalDay} · {bill.monthsSeen}/{LOOKBACK_MONTHS} mo</span>
					</div>
				</div>
			{/each}
			<div class="flex items-center justify-between border border-slate-700 bg-slate-900/80 p-3">
				<span class="text-sm font-semibold text-slate-300">Total This Month</span>
				<span class="font-mono text-sm font-bold text-red-400">${totalMonthly.toFixed(2)}</span>
			</div>
		</div>

		<!-- Desktop table -->
		<div class="hidden overflow-hidden border border-slate-800 md:block">
			<table class="w-full">
				<thead>
					<tr class="border-b border-slate-800 bg-slate-900/80">
						<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Merchant</th>
						<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
						<th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Typical Day</th>
						<th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Months Seen</th>
						<th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Amount</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800/50">
					{#each recurringBills as bill (bill.key)}
						{@const amount = bill.thisMonth ? Math.abs(bill.thisMonth.amount) : bill.avgAmount}
						<tr class="group transition-colors hover:bg-slate-800/30">
							<td class="px-4 py-3">
								{#if editingKey === bill.key}
									<div class="flex items-center gap-1">
										<input
											type="text"
											bind:value={editValue}
											class="min-w-0 flex-1 border border-accent-primary bg-slate-950 px-2 py-1 text-sm text-white focus:outline-none"
											onkeydown={(e) => {
												if (e.key === 'Enter') saveEdit(bill);
												if (e.key === 'Escape') cancelEdit();
											}}
										/>
										<button onclick={() => saveEdit(bill)} disabled={savingKey === bill.key} class="p-1 text-emerald-400 hover:text-emerald-300">
											<Check class="h-4 w-4" />
										</button>
										<button onclick={cancelEdit} class="p-1 text-slate-500 hover:text-slate-300">
											<X class="h-4 w-4" />
										</button>
									</div>
								{:else}
									<div class="flex items-center gap-2">
										<span class="font-medium {bill.isCustomTitle ? 'text-accent-primary' : 'text-slate-200'}">{bill.merchant}</span>
										<button
											onclick={() => startEdit(bill)}
											class="text-slate-500 transition-opacity hover:text-slate-300 md:opacity-0 md:group-hover:opacity-100"
											aria-label="Edit bill title"
										>
											<Pencil class="h-3.5 w-3.5" />
										</button>
									</div>
								{/if}
								<div class="mt-0.5 truncate text-xs text-slate-500" title={bill.sampleDescription}>{bill.sampleDescription}</div>
							</td>
							<td class="px-4 py-3">
								<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium {bill.thisMonth ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/40 text-slate-400'}">
									{bill.thisMonth ? 'Charged' : 'Expected'}
								</span>
							</td>
							<td class="px-4 py-3 text-center text-sm text-slate-400">
								{bill.thisMonth ? new Date(bill.thisMonth.date).getDate() : bill.typicalDay}
							</td>
							<td class="px-4 py-3 text-center text-sm text-slate-400">{bill.monthsSeen}/{LOOKBACK_MONTHS}</td>
							<td class="px-4 py-3 text-right">
								<span class="font-mono text-sm font-medium {bill.thisMonth ? 'text-red-400' : 'text-slate-500'}">${amount.toFixed(2)}</span>
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="border-t border-slate-700 bg-slate-900/80">
						<td colspan="4" class="px-4 py-3 text-sm font-semibold text-slate-300">
							Total This Month ({confirmedCount} charged · {recurringBills.length - confirmedCount} expected)
						</td>
						<td class="px-4 py-3 text-right">
							<span class="font-mono text-sm font-bold text-red-400">${totalMonthly.toFixed(2)}</span>
						</td>
					</tr>
				</tfoot>
			</table>
		</div>

		<!-- Summary -->
		<div class="border border-slate-800 bg-slate-900/50 p-4">
			<div class="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
				<div>
					<div class="text-2xl font-bold text-red-400">${totalMonthly.toFixed(2)}</div>
					<div class="mt-1 text-xs text-slate-500">{monthLabel} Total</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-slate-300">{recurringBills.length}</div>
					<div class="mt-1 text-xs text-slate-500">Recurring Bills</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-red-400">${(totalMonthly * 12).toFixed(2)}</div>
					<div class="mt-1 text-xs text-slate-500">Yearly Estimate</div>
				</div>
			</div>
		</div>
	{/if}
</div>

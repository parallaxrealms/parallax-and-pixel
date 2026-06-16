<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import type { BankAccount, CsvColumnMapping } from '$lib/types/finances';
	import {
		Upload,
		FileSpreadsheet,
		ArrowRight,
		ArrowLeft,
		Check,
		AlertTriangle,
		Loader2
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import {
		parseCSV,
		detectColumns,
		detectDateFormat,
		buildTransactions,
		findDuplicates,
		type ParsedCsv,
		type ParsedTransaction
	} from './bankCsvParser';

	interface Props {
		supabase: SupabaseClient;
		onImportComplete?: () => void;
	}

	let { supabase, onImportComplete }: Props = $props();

	let step = $state(1);
	let accounts = $state<BankAccount[]>([]);
	let selectedAccountId = $state('');
	let isLoadingAccounts = $state(true);

	let csvFile = $state<File | null>(null);
	let csvText = $state('');
	let parsedCsv = $state<ParsedCsv | null>(null);

	let mapping = $state<CsvColumnMapping>({
		date: '',
		description: '',
		amount: '',
		debit: '',
		credit: '',
		balance: '',
		reference: '',
		dateFormat: 'MM/DD/YYYY',
		singleAmount: true
	});

	let previewTransactions = $state<ParsedTransaction[]>([]);
	let duplicateIndices = $state<Set<number>>(new Set());

	let isImporting = $state(false);
	let importProgress = $state(0);
	let importResult = $state<{ import_id: string; inserted_count: number } | null>(null);

	async function loadAccounts() {
		if (!browser || !supabase) return;
		isLoadingAccounts = true;
		try {
			const { data, error } = await supabase.from('bank_accounts').select('*').order('name');
			if (error) throw error;
			accounts = data || [];
		} catch {
			toast.error('Failed to load accounts');
		} finally {
			isLoadingAccounts = false;
		}
	}

	$effect(() => {
		if (browser && supabase) loadAccounts();
	});

	async function handleFile(file: File) {
		csvFile = file;
		csvText = await file.text();
		parsedCsv = parseCSV(csvText);

		if (parsedCsv.headers.length > 0) {
			const detected = detectColumns(parsedCsv.headers);
			mapping = {
				date: detected.date || '',
				description: detected.description || '',
				amount: detected.amount || '',
				debit: detected.debit || '',
				credit: detected.credit || '',
				balance: detected.balance || '',
				reference: detected.reference || '',
				dateFormat: 'MM/DD/YYYY',
				singleAmount: detected.singleAmount ?? true
			};

			if (mapping.date && parsedCsv.rows.length > 0) {
				const dateSamples = parsedCsv.rows.slice(0, 10).map((r) => r[mapping.date]).filter(Boolean);
				mapping.dateFormat = detectDateFormat(dateSamples);
			}
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files[0];
		if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
			handleFile(file);
		} else {
			toast.error('Please drop a CSV file');
		}
	}

	async function buildPreview() {
		if (!parsedCsv || !mapping.date || !mapping.description) return;
		if (mapping.singleAmount && !mapping.amount) return;
		if (!mapping.singleAmount && !mapping.debit && !mapping.credit) return;

		previewTransactions = buildTransactions(parsedCsv.rows, mapping);

		if (selectedAccountId) {
			try {
				const { data } = await supabase
					.from('bank_transactions')
					.select('date, amount, description')
					.eq('account_id', selectedAccountId);

				duplicateIndices = findDuplicates(previewTransactions, data || []);
			} catch {
				duplicateIndices = new Set();
			}
		}

		step = 3;
	}

	async function doImport() {
		if (!selectedAccountId || previewTransactions.length === 0) return;

		isImporting = true;
		importProgress = 0;

		try {
			const toImport = previewTransactions.filter((_, i) => !duplicateIndices.has(i));

			if (toImport.length === 0) {
				toast.error('All transactions are duplicates. Nothing to import.');
				isImporting = false;
				return;
			}

			const dates = toImport.map((t) => t.date).sort();
			const period_start = dates[0];
			const period_end = dates[dates.length - 1];

			const response = await fetch('/api/bank/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					account_id: selectedAccountId,
					file_name: csvFile?.name || 'unknown.csv',
					transactions: toImport,
					column_mapping: mapping,
					period_start,
					period_end
				})
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.error || 'Import failed');
			}

			const result = await response.json();
			importResult = result.data;
			importProgress = 100;
			step = 4;
			toast.success(`Imported ${result.data.inserted_count} transactions`);
			onImportComplete?.();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Import failed');
		} finally {
			isImporting = false;
		}
	}

	function reset() {
		step = 1;
		csvFile = null;
		csvText = '';
		parsedCsv = null;
		selectedAccountId = '';
		previewTransactions = [];
		duplicateIndices = new Set();
		importResult = null;
		importProgress = 0;
	}

	let selectedAccount = $derived(accounts.find((a) => a.id === selectedAccountId));
	let canProceedStep1 = $derived(!!selectedAccountId && !!parsedCsv && parsedCsv.rows.length > 0);
	let canProceedStep2 = $derived(
		!!mapping.date &&
			!!mapping.description &&
			(mapping.singleAmount ? !!mapping.amount : !!mapping.debit || !!mapping.credit)
	);
	let nonDuplicateCount = $derived(previewTransactions.length - duplicateIndices.size);

	const inputCls =
		'w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-accent-primary focus:outline-none';
</script>

<div class="space-y-6">
	<!-- Step Indicator -->
	<div class="flex flex-wrap items-center gap-2">
		{#each [1, 2, 3, 4] as s (s)}
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center text-sm font-medium {s === step ? 'bg-accent-primary text-slate-950' : s < step ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}">
					{#if s < step}
						<Check class="h-4 w-4" />
					{:else}
						{s}
					{/if}
				</div>
				<span class="text-sm {s === step ? 'text-slate-200' : 'text-slate-500'}">
					{s === 1 ? 'Select & Upload' : s === 2 ? 'Map Columns' : s === 3 ? 'Preview' : 'Complete'}
				</span>
				{#if s < 4}
					<div class="mx-2 h-px w-8 bg-slate-700"></div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Step 1 -->
	{#if step === 1}
		<div class="grid gap-6 lg:grid-cols-2">
			<div class="border border-slate-800 bg-slate-950 p-5">
				<h3 class="mb-3 font-medium text-slate-200">Select Account</h3>
				{#if isLoadingAccounts}
					<div class="flex h-20 items-center justify-center">
						<Loader2 class="h-6 w-6 animate-spin text-slate-400" />
					</div>
				{:else if accounts.length === 0}
					<p class="text-sm text-slate-400">No accounts found. Create one in the Bank Accounts tab first.</p>
				{:else}
					<select bind:value={selectedAccountId} class={inputCls}>
						<option value="">Choose account...</option>
						{#each accounts as acc (acc.id)}
							<option value={acc.id}>{acc.name}{acc.institution_name ? ` (${acc.institution_name})` : ''}</option>
						{/each}
					</select>
				{/if}
			</div>

			<div class="border border-slate-800 bg-slate-950 p-5">
				<h3 class="mb-3 font-medium text-slate-200">Upload CSV</h3>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 p-8 transition-colors hover:border-accent-primary/50 {csvFile ? 'border-emerald-500/50 bg-emerald-500/5' : ''}"
					ondrop={handleDrop}
					ondragover={(e) => e.preventDefault()}
				>
					{#if csvFile}
						<FileSpreadsheet class="mb-2 h-8 w-8 text-emerald-400" />
						<p class="text-sm text-emerald-300">{csvFile.name}</p>
						<p class="text-xs text-slate-400">{parsedCsv?.rows.length || 0} rows found</p>
						<button onclick={() => { csvFile = null; parsedCsv = null; }} class="mt-2 text-xs text-slate-500 hover:text-slate-300">
							Remove
						</button>
					{:else}
						<Upload class="mb-2 h-8 w-8 text-slate-500" />
						<p class="text-sm text-slate-400">Drag & drop CSV file here</p>
						<label class="mt-2 cursor-pointer text-sm text-accent-primary hover:opacity-90">
							or browse files
							<input type="file" accept=".csv,text/csv" class="hidden" onchange={handleFileInput} />
						</label>
					{/if}
				</div>
			</div>
		</div>

		<div class="flex justify-end">
			<button
				disabled={!canProceedStep1}
				onclick={() => (step = 2)}
				class="flex items-center gap-1 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50"
			>
				Next: Map Columns <ArrowRight class="h-4 w-4" />
			</button>
		</div>

		<!-- Step 2 -->
	{:else if step === 2}
		<div class="border border-slate-800 bg-slate-950 p-5">
			<h3 class="mb-4 font-medium text-slate-200">Map CSV Columns</h3>
			<p class="mb-4 text-sm text-slate-400">Match your CSV columns to the expected fields. Auto-detected where possible.</p>

			<div class="mb-4 flex flex-wrap items-center gap-4">
				<span class="text-sm text-slate-300">Amount format:</span>
				<div class="flex items-center gap-2">
					<button onclick={() => (mapping.singleAmount = true)} class="px-3 py-1.5 text-sm {mapping.singleAmount ? 'bg-accent-primary text-slate-950' : 'bg-slate-700 text-slate-400'}">
						Single Amount Column
					</button>
					<button onclick={() => (mapping.singleAmount = false)} class="px-3 py-1.5 text-sm {!mapping.singleAmount ? 'bg-accent-primary text-slate-950' : 'bg-slate-700 text-slate-400'}">
						Separate Debit/Credit
					</button>
				</div>
			</div>

			{#if parsedCsv}
				{@const headers = parsedCsv.headers}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<label for="map-date" class="mb-1 block text-sm text-slate-300">Date Column *</label>
						<select id="map-date" bind:value={mapping.date} class={inputCls}>
							<option value="">Select...</option>
							{#each headers as h (h)}
								<option value={h}>{h}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="map-dformat" class="mb-1 block text-sm text-slate-300">Date Format</label>
						<select id="map-dformat" bind:value={mapping.dateFormat} class={inputCls}>
							<option value="MM/DD/YYYY">MM/DD/YYYY</option>
							<option value="DD/MM/YYYY">DD/MM/YYYY</option>
							<option value="YYYY-MM-DD">YYYY-MM-DD</option>
							<option value="M/D/YYYY">M/D/YYYY</option>
							<option value="MM-DD-YYYY">MM-DD-YYYY</option>
							<option value="DD-MM-YYYY">DD-MM-YYYY</option>
						</select>
					</div>

					<div>
						<label for="map-desc" class="mb-1 block text-sm text-slate-300">Description Column *</label>
						<select id="map-desc" bind:value={mapping.description} class={inputCls}>
							<option value="">Select...</option>
							{#each headers as h (h)}
								<option value={h}>{h}</option>
							{/each}
						</select>
					</div>

					{#if mapping.singleAmount}
						<div>
							<label for="map-amt" class="mb-1 block text-sm text-slate-300">Amount Column *</label>
							<select id="map-amt" bind:value={mapping.amount} class={inputCls}>
								<option value="">Select...</option>
								{#each headers as h (h)}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>
					{:else}
						<div>
							<label for="map-debit" class="mb-1 block text-sm text-slate-300">Debit Column</label>
							<select id="map-debit" bind:value={mapping.debit} class={inputCls}>
								<option value="">Select...</option>
								{#each headers as h (h)}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="map-credit" class="mb-1 block text-sm text-slate-300">Credit Column</label>
							<select id="map-credit" bind:value={mapping.credit} class={inputCls}>
								<option value="">Select...</option>
								{#each headers as h (h)}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>
					{/if}

					<div>
						<label for="map-bal" class="mb-1 block text-sm text-slate-300">Balance Column</label>
						<select id="map-bal" bind:value={mapping.balance} class={inputCls}>
							<option value="">None</option>
							{#each headers as h (h)}
								<option value={h}>{h}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="map-ref" class="mb-1 block text-sm text-slate-300">Reference Column</label>
						<select id="map-ref" bind:value={mapping.reference} class={inputCls}>
							<option value="">None</option>
							{#each headers as h (h)}
								<option value={h}>{h}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Sample Preview -->
				{#if parsedCsv.rows.length > 0}
					<div class="mt-6">
						<h4 class="mb-2 text-sm font-medium text-slate-300">Raw CSV Preview (first 3 rows)</h4>
						<div class="overflow-x-auto">
							<table class="w-full text-xs">
								<thead>
									<tr class="border-b border-slate-700">
										{#each parsedCsv.headers as h (h)}
											<th class="p-2 text-left text-slate-400">{h}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each parsedCsv.rows.slice(0, 3) as row, i (i)}
										<tr class="border-b border-slate-800">
											{#each parsedCsv.headers as h (h)}
												<td class="p-2 text-slate-300">{row[h]}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<div class="flex justify-between">
			<button onclick={() => (step = 1)} class="flex items-center gap-1 border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
				<ArrowLeft class="h-4 w-4" /> Back
			</button>
			<button
				disabled={!canProceedStep2}
				onclick={buildPreview}
				class="flex items-center gap-1 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50"
			>
				Next: Preview <ArrowRight class="h-4 w-4" />
			</button>
		</div>

		<!-- Step 3 -->
	{:else if step === 3}
		<div class="border border-slate-800 bg-slate-950 p-5">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="font-medium text-slate-200">Preview ({previewTransactions.length} transactions)</h3>
				{#if duplicateIndices.size > 0}
					<div class="flex items-center gap-2 text-amber-400">
						<AlertTriangle class="h-4 w-4" />
						<span class="text-sm">{duplicateIndices.size} potential duplicates (will be skipped)</span>
					</div>
				{/if}
			</div>

			<div class="max-h-[400px] overflow-x-auto overflow-y-auto">
				<table class="w-full min-w-[480px] text-sm">
					<thead class="sticky top-0 bg-slate-900">
						<tr class="border-b border-slate-700">
							<th class="p-2 text-left text-slate-400">Date</th>
							<th class="p-2 text-left text-slate-400">Description</th>
							<th class="p-2 text-right text-slate-400">Amount</th>
							{#if mapping.balance}
								<th class="p-2 text-right text-slate-400">Balance</th>
							{/if}
							<th class="p-2 text-left text-slate-400">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each previewTransactions.slice(0, 50) as txn, i (i)}
							<tr class="border-b border-slate-800 {duplicateIndices.has(i) ? 'opacity-40' : ''}">
								<td class="p-2 text-slate-300">{txn.date}</td>
								<td class="max-w-xs truncate p-2 text-slate-300">{txn.description}</td>
								<td class="p-2 text-right font-mono {txn.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}">
									{txn.amount >= 0 ? '+' : ''}{txn.amount.toFixed(2)}
								</td>
								{#if mapping.balance}
									<td class="p-2 text-right font-mono text-slate-400">{txn.balance?.toFixed(2) || '-'}</td>
								{/if}
								<td class="p-2">
									{#if duplicateIndices.has(i)}
										<span class="text-xs text-amber-400">Duplicate</span>
									{:else}
										<span class="text-xs text-emerald-400">New</span>
									{/if}
								</td>
							</tr>
						{/each}
						{#if previewTransactions.length > 50}
							<tr>
								<td colspan="5" class="p-3 text-center text-slate-500">... and {previewTransactions.length - 50} more rows</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>

			<div class="mt-4 flex gap-4 text-sm text-slate-400">
				<span>Total: {previewTransactions.length}</span>
				<span>To import: {nonDuplicateCount}</span>
				{#if duplicateIndices.size > 0}
					<span class="text-amber-400">Duplicates: {duplicateIndices.size}</span>
				{/if}
			</div>
		</div>

		<div class="flex justify-between">
			<button onclick={() => (step = 2)} class="flex items-center gap-1 border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
				<ArrowLeft class="h-4 w-4" /> Back
			</button>
			<button
				disabled={isImporting || nonDuplicateCount === 0}
				onclick={doImport}
				class="flex items-center gap-1 bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50"
			>
				{#if isImporting}
					<Loader2 class="h-4 w-4 animate-spin" /> Importing...
				{:else}
					Import {nonDuplicateCount} Transactions <Check class="h-4 w-4" />
				{/if}
			</button>
		</div>

		<!-- Step 4 -->
	{:else if step === 4}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center bg-emerald-500/20">
				<Check class="h-8 w-8 text-emerald-400" />
			</div>
			<h3 class="text-xl font-semibold text-slate-200">Import Complete</h3>
			{#if importResult}
				<p class="mt-2 text-slate-400">
					Successfully imported {importResult.inserted_count} transactions into {selectedAccount?.name || 'account'}.
				</p>
			{/if}
			<div class="mt-6 flex gap-3">
				<button onclick={reset} class="border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
					Import Another
				</button>
				<button onclick={() => onImportComplete?.()} class="bg-accent-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90">
					View Transactions
				</button>
			</div>
		</div>
	{/if}
</div>

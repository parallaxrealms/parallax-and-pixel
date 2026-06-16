<script lang="ts">
	/**
	 * Admin Website Audit tab — paste a URL, run the scoring engine (Lighthouse
	 * via PageSpeed Insights + Firecrawl scrape + probes), and download a
	 * Parallax & Pixel-branded PDF report.
	 *
	 * Talks to the admin-gated /api/admin/audit/* endpoints. The audit itself
	 * runs in the durable server worker; this tab enqueues + polls for results.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount, onDestroy } from 'svelte';
	import { Search, RefreshCw, FileText, AlertCircle, Loader2 } from 'lucide-svelte';

	// Convention: dashboard tabs receive {supabase}. This tab uses the admin API
	// proxies (service-role) instead, so the client is currently unused.
	let { supabase: _supabase } = $props<{ supabase: SupabaseClient }>();

	type Scores = {
		overall: number;
		performance: number;
		ai_readiness: number;
		seo: number;
	} | null;

	type AuditRow = {
		id: string;
		url: string;
		status: 'queued' | 'running' | 'complete' | 'failed';
		scores: Scores;
		step_label: string | null;
		error: string | null;
		pdf_storage_key: string | null;
		created_at: string;
		completed_at: string | null;
	};

	let urlInput = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let audits = $state<AuditRow[]>([]);
	let loading = $state(true);
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	const hasActive = $derived(audits.some((a) => a.status === 'queued' || a.status === 'running'));

	async function loadAudits() {
		try {
			const res = await fetch('/api/admin/audit/list');
			if (!res.ok) return;
			const body = (await res.json()) as { audits: AuditRow[] };
			audits = body.audits ?? [];
		} catch {
			/* transient — next poll retries */
		} finally {
			loading = false;
		}
	}

	async function runAudit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		const url = urlInput.trim();
		if (!url) {
			formError = 'Enter a URL to audit.';
			return;
		}
		submitting = true;
		try {
			const res = await fetch('/api/admin/audit/run', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url })
			});
			const body = (await res.json()) as { id?: string; error?: string };
			if (!res.ok) {
				formError = body.error ?? 'Could not start the audit.';
				return;
			}
			urlInput = '';
			await loadAudits();
			ensurePolling();
		} catch {
			formError = 'Network error — try again.';
		} finally {
			submitting = false;
		}
	}

	function ensurePolling() {
		if (pollTimer) return;
		pollTimer = setInterval(async () => {
			await loadAudits();
			if (!hasActive && pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
		}, 4000);
	}

	function fmtDate(iso: string): string {
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

	function hostOf(u: string): string {
		try {
			return new URL(u).hostname.replace(/^www\./, '');
		} catch {
			return u;
		}
	}

	function scoreColor(n: number): string {
		if (n >= 90) return 'text-emerald-400';
		if (n >= 75) return 'text-accent-primary';
		if (n >= 50) return 'text-amber-400';
		return 'text-red-400';
	}

	const STATUS_STYLES: Record<AuditRow['status'], string> = {
		queued: 'bg-slate-700 text-slate-300',
		running: 'bg-accent-primary/20 text-accent-primary',
		complete: 'bg-emerald-500/15 text-emerald-400',
		failed: 'bg-red-500/15 text-red-400'
	};

	onMount(() => {
		loadAudits().then(() => {
			if (hasActive) ensurePolling();
		});
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});
</script>

<div class="mx-auto max-w-5xl">
	<header class="mb-6">
		<h1 class="text-2xl font-bold text-white">Website Audit</h1>
		<p class="mt-1 text-sm text-slate-400">
			Score any site on performance, AI-readiness, and SEO — then export a branded PDF.
		</p>
	</header>

	<!-- Run form -->
	<form onsubmit={runAudit} class="mb-8 flex flex-col gap-3 sm:flex-row">
		<div class="relative flex-1">
			<Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
			<input
				type="text"
				bind:value={urlInput}
				placeholder="https://example.com"
				disabled={submitting}
				class="w-full border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none disabled:opacity-60"
			/>
		</div>
		<button
			type="submit"
			disabled={submitting}
			class="flex items-center justify-center gap-2 bg-accent-primary px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
		>
			{#if submitting}
				<Loader2 class="h-4 w-4 animate-spin" /> Starting…
			{:else}
				Run audit
			{/if}
		</button>
	</form>

	{#if formError}
		<div class="mb-6 flex items-center gap-2 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
			<AlertCircle class="h-4 w-4 shrink-0" />
			{formError}
		</div>
	{/if}

	<!-- Audits list -->
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Recent audits</h2>
		<button
			onclick={loadAudits}
			class="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-accent-primary"
		>
			<RefreshCw class="h-3.5 w-3.5" /> Refresh
		</button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else if audits.length === 0}
		<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500">
			No audits yet. Run one above.
		</div>
	{:else}
		<div class="overflow-hidden border border-slate-800">
			<table class="w-full text-left text-sm">
				<thead class="bg-slate-900 text-xs uppercase tracking-wider text-slate-500">
					<tr>
						<th class="px-4 py-3 font-medium">Site</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 text-center font-medium">Overall</th>
						<th class="hidden px-4 py-3 text-center font-medium sm:table-cell">Perf</th>
						<th class="hidden px-4 py-3 text-center font-medium sm:table-cell">AI</th>
						<th class="hidden px-4 py-3 text-center font-medium sm:table-cell">SEO</th>
						<th class="px-4 py-3 font-medium">When</th>
						<th class="px-4 py-3 text-right font-medium">Report</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800">
					{#each audits as a (a.id)}
						<tr class="bg-slate-950 hover:bg-slate-900/60">
							<td class="max-w-[180px] truncate px-4 py-3 font-medium text-white" title={a.url}>
								{hostOf(a.url)}
							</td>
							<td class="px-4 py-3">
								<span class="inline-block px-2 py-0.5 text-xs font-medium {STATUS_STYLES[a.status]}">
									{a.status}
								</span>
								{#if a.status === 'running' && a.step_label}
									<div class="mt-1 text-xs text-slate-500">{a.step_label}</div>
								{/if}
								{#if a.status === 'failed' && a.error}
									<div class="mt-1 max-w-[200px] truncate text-xs text-red-400" title={a.error}>
										{a.error}
									</div>
								{/if}
							</td>
							<td class="px-4 py-3 text-center">
								{#if a.scores}
									<span class="text-base font-bold {scoreColor(a.scores.overall)}">{a.scores.overall}</span>
								{:else}
									<span class="text-slate-600">—</span>
								{/if}
							</td>
							<td class="hidden px-4 py-3 text-center sm:table-cell">
								{#if a.scores}<span class={scoreColor(a.scores.performance)}>{a.scores.performance}</span>{:else}<span class="text-slate-600">—</span>{/if}
							</td>
							<td class="hidden px-4 py-3 text-center sm:table-cell">
								{#if a.scores}<span class={scoreColor(a.scores.ai_readiness)}>{a.scores.ai_readiness}</span>{:else}<span class="text-slate-600">—</span>{/if}
							</td>
							<td class="hidden px-4 py-3 text-center sm:table-cell">
								{#if a.scores}<span class={scoreColor(a.scores.seo)}>{a.scores.seo}</span>{:else}<span class="text-slate-600">—</span>{/if}
							</td>
							<td class="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDate(a.created_at)}</td>
							<td class="px-4 py-3 text-right">
								{#if a.pdf_storage_key}
									<a
										href={`/api/admin/audit/${a.id}/report.pdf?dl=1`}
										class="inline-flex items-center gap-1.5 text-xs font-medium text-accent-primary transition hover:underline"
									>
										<FileText class="h-3.5 w-3.5" /> PDF
									</a>
								{:else if a.status === 'complete'}
									<span class="text-xs text-slate-600">rendering…</span>
								{:else}
									<span class="text-xs text-slate-700">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

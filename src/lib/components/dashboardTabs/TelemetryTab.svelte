<script lang="ts">
	/**
	 * Admin Telemetry tab — server health (Glances) + site telemetry (Prometheus).
	 *
	 * Top: three compact server cards (YGG / MIDGARD / HEL1) polled every 7s via
	 * the admin-gated /api/servers/[server] proxy.
	 * Below: site telemetry over the admin-gated /api/telemetry/query Prometheus
	 * proxy — stat tiles, status-class + latency charts, top routes, web vitals.
	 *
	 * Ported from 9realms (HeimdallOverview server cards + Odin TelemetryTab),
	 * native SVG charts only, restyled to the p&p slate admin palette.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { onMount } from 'svelte';
	import {
		TreePine,
		Shield,
		Brain,
		RefreshCw,
		AlertCircle,
		Activity,
		Server
	} from 'lucide-svelte';
	import ServerCard from '$lib/components/dashboardTabs/telemetry/ServerCard.svelte';
	import type { ServerSnapshot } from '$lib/components/dashboardTabs/telemetry/types';
	import StatTile from '$lib/components/dashboardTabs/telemetry/charts/StatTile.svelte';
	import TimeSeriesChart from '$lib/components/dashboardTabs/telemetry/charts/TimeSeriesChart.svelte';
	import type { ChartSeries as Series } from '$lib/components/dashboardTabs/telemetry/charts/types';
	import {
		runTelemetryQueries,
		matrixToSeries,
		matrixToMultiSeries,
		instantValue,
		formatNumber,
		formatPercent,
		formatMs,
		type TelemetryResponse,
		type PromVectorResult
	} from '$lib/telemetry/client';

	// Convention: dashboard tabs receive {supabase}. This tab talks to the
	// admin-gated API proxies instead, so the client is currently unused.
	let { supabase: _supabase } = $props<{ supabase: SupabaseClient }>();

	// ── Server health cards (Glances via /api/servers/[server]) ───────────────

	const servers = [
		{ id: 'ygg', name: 'YGG', role: 'Development', icon: TreePine },
		{ id: 'midgard', name: 'MIDGARD', role: 'Production', icon: Shield },
		{ id: 'hel1', name: 'HEL1', role: 'Bifrost Daemon', icon: Brain }
	];

	let snapshots = $state<Record<string, ServerSnapshot | null>>({
		ygg: null,
		midgard: null,
		hel1: null
	});
	let serverErrors = $state<Record<string, string | null>>({
		ygg: null,
		midgard: null,
		hel1: null
	});
	let serversLoading = $state(false);
	let serversAutoRefresh = $state(true);
	let lastUpdate = $state<number | null>(null);

	async function loadServers() {
		serversLoading = true;
		await Promise.all(
			servers.map(async (s) => {
				try {
					const res = await fetch(`/api/servers/${s.id}`);
					const body = (await res.json()) as {
						configured: boolean;
						snapshot: ServerSnapshot | null;
						error?: string;
					};
					if (!body.configured) {
						serverErrors[s.id] = 'Glances not configured';
						snapshots[s.id] = null;
					} else if (!body.snapshot) {
						serverErrors[s.id] = body.error ?? 'No data';
						snapshots[s.id] = null;
					} else {
						snapshots[s.id] = body.snapshot;
						serverErrors[s.id] = null;
					}
				} catch (e) {
					serverErrors[s.id] = e instanceof Error ? e.message : 'Fetch failed';
					snapshots[s.id] = null;
				}
			})
		);
		lastUpdate = Date.now();
		serversLoading = false;
	}

	$effect(() => {
		if (!serversAutoRefresh) return;
		const id = setInterval(loadServers, 7_000);
		return () => clearInterval(id);
	});

	// ── Site telemetry (Prometheus via /api/telemetry/query) ──────────────────

	const services = [
		{ id: 'dialup-dungeon', label: 'DialUp Dungeon' },
		{ id: 'parallax-and-pixel', label: 'Parallax & Pixel' }
	];

	const timeRanges = [
		{ id: 'now-1h', label: '1h' },
		{ id: 'now-6h', label: '6h' },
		{ id: 'now-24h', label: '24h' },
		{ id: 'now-7d', label: '7d' }
	];

	let activeService = $state(services[0].id);
	let activeRange = $state('now-6h');
	let autoRefresh = $state(true);

	let data = $state<TelemetryResponse | null>(null);
	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	let configured = $state(true);

	const STATUS_COLORS: Record<string, string> = {
		'2xx': '#34d399',
		'3xx': '#60a5fa',
		'4xx': '#fbbf24',
		'5xx': '#f87171'
	};

	function buildQueries(svc: string) {
		// OTel→Prometheus translation gotchas (proven wire contract — do not
		// invent new metric names):
		//   - service.name resource attr → `job` label (NOT `service_name`)
		//   - histogram unit ms → `_milliseconds` infix in metric name
		//   - values already in ms, so no `* 1000` conversion needed
		const f = `job="${svc}"`;
		const bucket = `http_server_request_duration_milliseconds_bucket{${f}}`;
		const count = `http_server_request_duration_milliseconds_count{${f}}`;
		const countErr = `http_server_request_duration_milliseconds_count{${f},http_response_status_code=~"5.."}`;
		return [
			{ key: 'req_rate', expr: `sum(rate(${count}[5m]))` },
			{
				key: 'err_rate',
				expr: `sum(rate(${countErr}[5m])) / clamp_min(sum(rate(${count}[5m])), 1e-9)`
			},
			{ key: 'p95', expr: `histogram_quantile(0.95, sum by (le) (rate(${bucket}[5m])))` },
			{ key: 'p99', expr: `histogram_quantile(0.99, sum by (le) (rate(${bucket}[5m])))` },
			{
				key: 'status',
				expr: `sum by (status_class) (label_replace(rate(${count}[5m]), "status_class", "$1xx", "http_response_status_code", "([0-9])[0-9]{2}"))`
			},
			{ key: 'p50_ts', expr: `histogram_quantile(0.50, sum by (le) (rate(${bucket}[5m])))` },
			{ key: 'p95_ts', expr: `histogram_quantile(0.95, sum by (le) (rate(${bucket}[5m])))` },
			{ key: 'p99_ts', expr: `histogram_quantile(0.99, sum by (le) (rate(${bucket}[5m])))` },
			{
				key: 'top_routes',
				expr: `topk(8, sum by (http_route) (rate(${count}[5m])))`,
				instant: true
			},
			{
				key: 'route_p95',
				expr: `histogram_quantile(0.95, sum by (le, http_route) (rate(${bucket}[5m])))`,
				instant: true
			},
			{
				key: 'web_vitals_p75',
				expr: `histogram_quantile(0.75, sum by (le, vital_name) (rate(web_vitals_bucket{${f}}[1h])))`,
				instant: true
			}
		];
	}

	async function load() {
		loading = true;
		errorMsg = null;
		try {
			const res = await runTelemetryQueries(buildQueries(activeService), activeRange);
			data = res;
			configured = res.configured;
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Failed to load telemetry';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadServers();
	});

	// $effect never runs during SSR, so this fires once on mount and again on
	// every service/range switch — same pattern as the donor tab.
	$effect(() => {
		void activeService;
		void activeRange;
		load();
	});

	$effect(() => {
		if (!autoRefresh) return;
		const id = setInterval(load, 30_000);
		return () => clearInterval(id);
	});

	function valFor(key: string): number | null {
		if (!data) return null;
		return instantValue(data.results[key]);
	}

	let reqRate = $derived(valFor('req_rate'));
	let errRate = $derived(valFor('err_rate'));
	let p95Val = $derived(valFor('p95'));
	let p99Val = $derived(valFor('p99'));

	let reqRateSeries = $derived<Series[]>(
		data
			? [matrixToSeries(data.results['req_rate'], { key: 'req_rate', label: 'req/s', color: '#34d399' })]
			: []
	);
	let errRateSeries = $derived.by<Series[]>(() => {
		if (!data) return [];
		const base = matrixToSeries(data.results['err_rate'], {
			key: 'err_rate',
			label: 'errors %',
			color: '#f87171'
		});
		return [
			{
				...base,
				points: base.points.map((p) => ({ t: p.t, v: p.v === null ? null : p.v * 100 }))
			}
		];
	});
	let p95Series = $derived<Series[]>(
		data
			? [matrixToSeries(data.results['p95'], { key: 'p95', label: 'p95 ms', color: '#fbbf24' })]
			: []
	);
	let p99Series = $derived<Series[]>(
		data
			? [matrixToSeries(data.results['p99'], { key: 'p99', label: 'p99 ms', color: '#a78bfa' })]
			: []
	);

	let statusSeries = $derived<Series[]>(
		data
			? matrixToMultiSeries(data.results['status'], {
					keyPrefix: 'status',
					labelFromMetric: (m) => m.status_class ?? '?',
					colorFor: (label) => STATUS_COLORS[label] ?? '#94a3b8'
				})
			: []
	);

	let latencyAllSeries = $derived<Series[]>(
		data
			? [
					matrixToSeries(data.results['p50_ts'], { key: 'p50', label: 'p50', color: '#60a5fa' }),
					matrixToSeries(data.results['p95_ts'], { key: 'p95', label: 'p95', color: '#fbbf24' }),
					matrixToSeries(data.results['p99_ts'], { key: 'p99', label: 'p99', color: '#a78bfa' })
				]
			: []
	);

	interface RouteRow {
		route: string;
		rps: number;
		p95: number | null;
	}
	let topRoutes = $derived<RouteRow[]>(buildTopRoutes(data));
	function buildTopRoutes(d: TelemetryResponse | null): RouteRow[] {
		if (!d) return [];
		const r = d.results['top_routes'];
		const p95r = d.results['route_p95'];
		if (!r || r.status !== 'success' || !r.data || r.data.resultType !== 'vector') return [];
		const p95Map = new Map<string, number>();
		if (p95r && p95r.status === 'success' && p95r.data?.resultType === 'vector') {
			for (const row of p95r.data.result) {
				const route = row.metric.http_route ?? '';
				const n = Number(row.value[1]);
				if (route && isFinite(n)) p95Map.set(route, n);
			}
		}
		return r.data.result
			.map((row) => ({
				route: row.metric.http_route ?? '(unknown)',
				rps: Number(row.value[1]) || 0,
				p95: p95Map.get(row.metric.http_route ?? '') ?? null
			}))
			.sort((a, b) => b.rps - a.rps);
	}

	function routeP95Color(p95: number | null): string {
		if (p95 === null) return 'text-slate-500';
		if (p95 >= 1000) return 'text-red-400';
		if (p95 >= 500) return 'text-amber-400';
		return 'text-emerald-400';
	}

	// ── Web Vitals (p75 by vital_name from the web_vitals histogram) ──────────
	const VITAL_ORDER = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
	interface VitalRow {
		name: string;
		value: number;
	}
	let webVitals = $derived.by<VitalRow[]>(() => {
		const resp = data?.results['web_vitals_p75'];
		if (!resp || resp.status !== 'success' || !resp.data || resp.data.resultType !== 'vector') {
			return [];
		}
		return (resp.data.result as PromVectorResult[])
			.map((r) => ({ name: r.metric.vital_name ?? '?', value: Number(r.value[1]) }))
			.filter((v) => isFinite(v.value))
			.sort((a, b) => {
				const ai = VITAL_ORDER.indexOf(a.name);
				const bi = VITAL_ORDER.indexOf(b.name);
				return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
			});
	});

	function formatVital(name: string, value: number): string {
		// CLS is a unitless layout-shift score; everything else is ms.
		if (name === 'CLS') return value.toFixed(3);
		return formatMs(value);
	}

	function refreshAll() {
		loadServers();
		load();
	}
</script>

<div class="mx-auto max-w-[1400px] space-y-4">
	<!-- ── Server health ────────────────────────────────────────────────────── -->
	<div class="flex items-center justify-between border-b border-slate-700 pb-2">
		<div class="flex items-center gap-2">
			<Server class="h-4 w-4 text-slate-300" />
			<div>
				<h2 class="text-lg font-light tracking-wide text-slate-100">Server Health</h2>
				<p class="text-[11px] text-slate-500">
					YGG · MIDGARD · HEL1 — {serversAutoRefresh ? 'auto-refresh every 7s' : 'auto-refresh paused'}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-3 text-[11px] text-slate-500">
			{#if lastUpdate}
				<span>updated {new Date(lastUpdate).toLocaleTimeString()}</span>
			{/if}
			<label class="flex items-center gap-1 text-xs text-slate-400">
				<input type="checkbox" bind:checked={serversAutoRefresh} class="h-3 w-3 accent-[#00a5cf]" />
				auto
			</label>
			<button
				onclick={loadServers}
				class="p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
				title="Refresh servers"
			>
				<RefreshCw class="h-3.5 w-3.5 {serversLoading ? 'animate-spin' : ''}" />
			</button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-3 xl:grid-cols-3">
		{#each servers as server (server.id)}
			<ServerCard
				name={server.name}
				role={server.role}
				icon={server.icon}
				snapshot={snapshots[server.id]}
				error={serverErrors[server.id]}
				loading={serversLoading && !snapshots[server.id]}
			/>
		{/each}
	</div>

	<!-- ── Site telemetry ───────────────────────────────────────────────────── -->
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-1">
		<div class="flex items-center gap-2">
			<Activity class="h-4 w-4 text-slate-300" />
			<div>
				<h2 class="text-lg font-light tracking-wide text-slate-100">Site Telemetry</h2>
				<p class="text-[11px] text-slate-500">native prometheus · http server metrics</p>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2 pb-1">
			<div class="flex border border-slate-700">
				{#each services as service (service.id)}
					<button
						onclick={() => (activeService = service.id)}
						class="px-3 py-2 text-sm font-medium transition-colors md:text-xs {activeService ===
						service.id
							? 'bg-slate-700 text-accent-primary'
							: 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'}"
					>
						{service.label}
					</button>
				{/each}
			</div>
			<div class="flex border border-slate-700">
				{#each timeRanges as range (range.id)}
					<button
						onclick={() => (activeRange = range.id)}
						class="px-3 py-2 text-sm transition-colors md:px-2 md:py-1 md:text-xs {activeRange ===
						range.id
							? 'bg-slate-700 text-slate-100'
							: 'text-slate-400 hover:bg-slate-800'}"
					>
						{range.label}
					</button>
				{/each}
			</div>
			<label class="flex items-center gap-1 text-xs text-slate-400">
				<input type="checkbox" bind:checked={autoRefresh} class="h-3 w-3 accent-[#00a5cf]" />
				auto
			</label>
			<button
				onclick={refreshAll}
				class="p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
				title="Refresh"
			>
				<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
			</button>
		</div>
	</div>

	{#if errorMsg}
		<div
			class="flex items-start gap-2 border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300"
		>
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
			<div>{errorMsg}</div>
		</div>
	{/if}

	{#if !configured}
		<div class="border border-slate-700 bg-slate-900/50 p-8 text-center">
			<Activity class="mx-auto mb-3 h-8 w-8 text-slate-600" />
			<div class="text-sm font-medium text-slate-200">Telemetry not configured</div>
			<p class="mx-auto mt-1 max-w-md text-xs text-slate-500">
				Set <span class="font-mono text-slate-300">PROMETHEUS_URL</span> (and
				<span class="font-mono text-slate-300">PROMETHEUS_BASIC_AUTH</span> or
				<span class="font-mono text-slate-300">PROMETHEUS_BEARER</span>) in the environment to
				enable native site metrics.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatTile
				label="Request Rate"
				value={formatNumber(reqRate)}
				valueColor="text-emerald-400"
				sparkline={reqRateSeries[0]?.points}
				sparkColor="#34d399"
				hint="req/s"
				{loading}
			/>
			<StatTile
				label="Error Rate"
				value={errRate === null ? '·' : formatPercent(errRate * 100)}
				valueColor="text-red-400"
				sparkline={errRateSeries[0]?.points}
				sparkColor="#f87171"
				hint="% 5xx"
				{loading}
			/>
			<StatTile
				label="p95 Latency"
				value={formatMs(p95Val)}
				valueColor="text-amber-400"
				sparkline={p95Series[0]?.points}
				sparkColor="#fbbf24"
				{loading}
			/>
			<StatTile
				label="p99 Latency"
				value={formatMs(p99Val)}
				valueColor="text-violet-400"
				sparkline={p99Series[0]?.points}
				sparkColor="#a78bfa"
				{loading}
			/>
		</div>

		<div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
			<TimeSeriesChart
				title="Requests by Status Class"
				unit="req/s"
				series={statusSeries}
				height={200}
				yFormat={(v) => v.toFixed(2)}
				yMin={0}
				{loading}
			/>
			<TimeSeriesChart
				title="Latency Percentiles"
				unit="ms"
				series={latencyAllSeries}
				height={200}
				yFormat={(v) => v.toFixed(0)}
				yMin={0}
				{loading}
			/>
		</div>

		<div class="border border-slate-800 bg-slate-900/40">
			<div class="border-b border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300">
				Top Routes
			</div>
			{#if topRoutes.length === 0}
				<div class="p-3 text-xs text-slate-600">No route data</div>
			{:else}
				<table class="w-full text-xs">
					<thead>
						<tr class="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
							<th class="px-3 py-1.5 text-left font-semibold">Route</th>
							<th class="px-3 py-1.5 text-right font-semibold">req/s</th>
							<th class="px-3 py-1.5 text-right font-semibold">p95 ms</th>
						</tr>
					</thead>
					<tbody>
						{#each topRoutes as row (row.route)}
							<tr class="border-b border-slate-800/60 last:border-b-0 hover:bg-slate-800/30">
								<td class="px-3 py-1.5 font-mono text-slate-300">{row.route}</td>
								<td class="px-3 py-1.5 text-right font-mono text-slate-200">
									{formatNumber(row.rps, 3)}
								</td>
								<td class="px-3 py-1.5 text-right font-mono {routeP95Color(row.p95)}">
									{row.p95 === null ? '·' : row.p95.toFixed(0)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>

		{#if webVitals.length > 0}
			<div class="border border-slate-800 bg-slate-900/40">
				<div
					class="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300"
				>
					<span>Web Vitals</span>
					<span class="font-mono text-[10px] font-normal text-slate-500">p75 · last 1h</span>
				</div>
				<div class="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-3 lg:grid-cols-5">
					{#each webVitals as vital (vital.name)}
						<div class="bg-slate-900 p-3 text-center">
							<div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
								{vital.name}
							</div>
							<div class="mt-1 font-mono text-lg font-light text-slate-100">
								{formatVital(vital.name, vital.value)}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

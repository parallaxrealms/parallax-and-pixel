import type { SceneDoc } from '../schema';

// Group tints — Emit (red observe), Backend (blue), Watcher (slate infra).
const C = {
	emit: '#ef4444',
	backend: '#3b82f6',
	watcher: '#94a3b8'
};

/**
 * Observability — the Level-2 drill-down behind the "Observability" cylinder
 * of `9realms-stack`. Draws OpenTelemetry emission via the `ygg-otel` backend,
 * per-host Glances behind Traefik basicauth, and the HEIMDALL mode as the
 * in-dashboard watcher. Authored from the stack panel + `ref/HEIMDALL.md` /
 * `CLAUDE.md`. High-level where exact internals aren't known from the repo/docs.
 */
export const observabilityStackScene: SceneDoc = {
	id: 'stack-observability',
	slug: 'stack-observability',
	name: 'Observability — OpenTelemetry · Glances · Heimdall',
	description: 'OTel spans/metrics via ygg-otel, per-host Glances, the HEIMDALL watcher.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Observability' },
		groups: [
			{ id: 'emit', label: 'Emitters', color: C.emit },
			{ id: 'backend', label: 'Backend', color: C.backend },
			{ id: 'watcher', label: 'Watcher', color: C.watcher }
		],
		nodes: [
			{
				id: 'otel',
				label: 'OpenTelemetry',
				group: 'emit',
				color: C.emit,
				panel: `**Spans + metrics from the running system.**

- Instrumentation emits OpenTelemetry spans and metrics
- Hosts (midgard, the agent host) export traces
- Sent to the \`ygg-otel\` backend`
			},
			{
				id: 'glances',
				label: 'Glances',
				group: 'emit',
				color: C.emit,
				panel: `**Per-host system stats.**

- A Glances agent per host (live CPU / mem / disk)
- Surfaced behind Traefik basicauth
- The "eyes" the Servers tab reads from`
			},
			{
				id: 'ygg-otel',
				label: 'ygg-otel backend',
				group: 'backend',
				color: C.backend,
				panel: `**The telemetry sink.**

- Receives OpenTelemetry spans + metrics
- The collection point the dashboard reads back from`
			},
			{
				id: 'heimdall',
				label: 'HEIMDALL mode',
				group: 'watcher',
				color: C.watcher,
				panel: `**The in-dashboard watcher.**

- Watches host health (Glances) across the Hetzner boxes
- Surfaces anomalies + recommendations; execution is approval-gated
- Servers tab (Glances live charts) is its "eyes" and is already shipped`
			},
			{
				id: 'servers-tab',
				label: 'Servers tab',
				group: 'watcher',
				color: C.watcher,
				panel: `**The live read-only stats surface.**

- Renders Glances charts per host
- Phase 0 of Heimdall — read-only, no command execution
- The proven, shipped piece of the observability stack`
			}
		],
		edges: [
			{ source: 'otel', target: 'ygg-otel', kind: 'event', label: 'spans', animated: true },
			{ source: 'glances', target: 'servers-tab', kind: 'data', label: 'stats', animated: true },
			{ source: 'servers-tab', target: 'heimdall', kind: 'dep', label: 'eyes of' },
			{ source: 'ygg-otel', target: 'heimdall', kind: 'data', label: 'surfaced in' }
		]
	}
};

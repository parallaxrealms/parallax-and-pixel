<script lang="ts">
	/**
	 * DaedalusViewer — renders a SceneDoc with one of the primitives and a
	 * drill-down detail panel. The panel is an HTML overlay (markdown via marked),
	 * kept separate from the canvas so text stays crisp and export-clean.
	 */
	import { marked } from 'marked';
	import {
		X,
		Settings,
		Plus,
		Box,
		Grid3x3,
		RotateCw,
		RefreshCw,
		ChevronRight,
		ChevronLeft
	} from 'lucide-svelte';
	import type {
		SceneDoc,
		VizData,
		VizEdge,
		VizGroup,
		SceneEnvironment
	} from './schema';
	import { resolveSceneData, sceneIsLive } from './adapters/resolve';
	import { allScenes } from './library';
	import StackScene from './primitives/StackScene.svelte';
	import GraphScene from './primitives/GraphScene.svelte';
	import Graph3DScene from './primitives/Graph3DScene.svelte';
	import BarScene from './primitives/BarScene.svelte';
	import PieScene from './primitives/PieScene.svelte';
	import StatScene from './primitives/StatScene.svelte';
	import GaugeScene from './primitives/GaugeScene.svelte';
	import BulletScene from './primitives/BulletScene.svelte';
	import LineScene from './primitives/LineScene.svelte';
	import RadarScene from './primitives/RadarScene.svelte';
	import TableScene from './primitives/TableScene.svelte';
	import HeatmapScene from './primitives/HeatmapScene.svelte';
	import SankeyScene from './primitives/SankeyScene.svelte';
	import TimelineScene from './primitives/TimelineScene.svelte';
	import TreemapScene from './primitives/TreemapScene.svelte';
	import LayerInspector from './LayerInspector.svelte';
	import NodeInspector from './NodeInspector.svelte';
	import CategoryInspector from './CategoryInspector.svelte';
	import ScalarInspector from './ScalarInspector.svelte';
	import SeriesInspector from './SeriesInspector.svelte';
	import TableInspector from './TableInspector.svelte';
	import GroupInspector from './GroupInspector.svelte';
	import EdgeInspector from './EdgeInspector.svelte';
	import SceneSettings from './SceneSettings.svelte';

	interface Props {
		scene: SceneDoc;
		/** Studio = true: the right panel becomes a live inspector. Embedded = false: read-only. */
		editable?: boolean;
	}
	let { scene, editable = false }: Props = $props();

	// Drill-down navigation: a stack of sub-scenes pushed via VizLink. The base
	// scene is the `scene` prop; the active scene is the top of the stack (or the
	// base when the stack is empty). EVERYTHING below reads `activeScene`, never
	// `scene` directly. Sub-scenes are read-only in v1.
	let navStack = $state<SceneDoc[]>([]);
	let activeScene = $derived(navStack.at(-1) ?? scene);
	// Editing is only allowed at base depth AND on static scenes — a live (adapter-
	// bound) scene's output isn't persisted, so we never pretend it's editable.
	// Inspectors mutate the scene object, and they only ever render when navStack is
	// empty (so activeScene === scene).
	let canEdit = $derived(editable && navStack.length === 0 && !sceneIsLive(activeScene));

	// --- Live data resolution ------------------------------------------------
	// `resolvedData` holds the VizData the canvas/selection actually read: the
	// adapter-produced data for a live scene, or the authored `activeScene.data`
	// otherwise. `viewData` is the accessor everything below reads from. INSPECTORS
	// keep binding `activeScene.data` directly (only reachable when NOT live).
	// Seeded from the initial scene; the $effect below keeps it in sync (and for a
	// live scene immediately replaces it with adapter output). The initial read of
	// `scene` here is intentional — a one-time seed, not a reactive dependency.
	// svelte-ignore state_referenced_locally
	let resolvedData = $state<VizData>(scene.data);
	let viewData = $derived(resolvedData);
	// Bumped by the Refresh button to force a live re-resolve + canvas remount.
	let refreshNonce = $state(0);
	// True while awaiting an adapter build (subtle loading indicator).
	let liveLoading = $state(false);

	// Re-resolve whenever the active scene (or refreshNonce) changes. For live
	// scenes we await the adapter and guard against races: capture the scene id at
	// dispatch and ignore the result if the active scene changed meanwhile. Static
	// scenes resolve synchronously to their authored data.
	$effect(() => {
		// Touch refreshNonce so a Refresh re-runs even for the same scene.
		void refreshNonce;
		const target = activeScene;
		if (!sceneIsLive(target)) {
			liveLoading = false;
			resolvedData = target.data;
			return;
		}
		const targetId = target.id;
		liveLoading = true;
		let stale = false;
		resolveSceneData(target)
			.then((data) => {
				if (stale || activeScene.id !== targetId) return;
				resolvedData = data;
			})
			.catch(() => {
				if (stale || activeScene.id !== targetId) return;
				resolvedData = target.data;
			})
			.finally(() => {
				if (stale || activeScene.id !== targetId) return;
				liveLoading = false;
			});
		return () => {
			stale = true;
		};
	});

	let selectedId = $state<string | null>(null);
	// Heatmap cell selection — a tiny read-only readout (no full inspector this wave).
	let selectedCell = $state<{ x: number; y: number } | null>(null);
	// Extended selection model (graph/tree): an edge or a group can be selected
	// instead of a node. Exactly one of node/edge/group is ever active.
	let selectedEdgeKey = $state<string | null>(null);
	let selectedGroupId = $state<string | null>(null);
	// Bumped to force a StackScene remount (e.g. "Reset view") without mutating env.
	let viewNonce = $state(0);
	// capturePng is sync for canvas/WebGL primitives, async (Promise) for SVG charts.
	let vizRef = $state<{ capturePng: () => string | null | Promise<string | null> } | null>(null);
	let sceneSettingsOpen = $state(false);

	// Primitive families.
	let isScalarChart = $derived(
		activeScene.primitive === 'stat' ||
			activeScene.primitive === 'gauge' ||
			activeScene.primitive === 'bullet'
	);
	let isCategoryChart = $derived(
		activeScene.primitive === 'bar' || activeScene.primitive === 'pie'
	);
	let isSeriesChart = $derived(
		activeScene.primitive === 'line' ||
			activeScene.primitive === 'area' ||
			activeScene.primitive === 'scatter'
	);
	let isTable = $derived(activeScene.primitive === 'table');
	let isGraphLike = $derived(
		activeScene.primitive === 'graph' || activeScene.primitive === 'tree'
	);
	let is3dGraph = $derived(isGraphLike && activeScene.dimension === '3d');
	// Sankey + Treemap select NODES (they reuse the node selection/panel/drill path).
	let isNodePrimitive = $derived(
		activeScene.primitive === 'sankey' || activeScene.primitive === 'treemap'
	);
	let isHeatmap = $derived(activeScene.primitive === 'heatmap');
	let isTimeline = $derived(activeScene.primitive === 'timeline');
	let lineMode = $derived(
		activeScene.primitive === 'area'
			? 'area'
			: activeScene.primitive === 'scatter'
				? 'scatter'
				: 'line'
	) as 'line' | 'area' | 'scatter';
	// Scalar charts + tables have no selectable items, so no right-click add/dup/delete
	// menu. Heatmap/timeline aren't item-editable this wave (read-only readout only),
	// so they're excluded too. Sankey/treemap DO select nodes (reuse the node panel)
	// but item editing isn't supported yet, so they also stay out of the edit menu.
	let supportsItems = $derived(
		!isScalarChart && !isTable && !isHeatmap && !isTimeline && !isNodePrimitive
	);
	// New primitives have a clickable selection (node/cell/track) but no edit menu —
	// still show an "inspect" hint when nothing is selected.
	let supportsSelectHint = $derived(supportsItems || isNodePrimitive || isHeatmap || isTimeline);

	let tipText = $derived.by(() => {
		switch (activeScene.primitive) {
			case 'graph':
			case 'tree':
				return 'Click a node to edit. "+ Node" adds one. Drag from a node border to another to connect; hover an edge for the x.';
			case 'bar':
			case 'pie':
				return 'Click a bar/slice to edit its value. "+ Category" adds one; right-click to duplicate or delete.';
			case 'line':
			case 'area':
			case 'scatter':
				return 'Click a line/legend to edit a series. "+ Series" adds one. Edit points as "x, y" lines in the inspector.';
			default:
				return 'Click a layer to edit it. Use "+ Layer" to add.';
		}
	});

	// Exposed so the studio header can capture this scene for PNG/PDF export.
	export async function capturePng(): Promise<string | null> {
		const r = vizRef?.capturePng();
		return r ? await r : null;
	}

	// Drill-down item is a layer (Stack), node (Graph/Tree), or category (Bar/Pie) —
	// each carries label + color; only layers/nodes carry a markdown panel.
	let selectedItem = $derived(
		viewData.layers?.find((l) => l.id === selectedId) ??
			viewData.nodes?.find((n) => n.id === selectedId) ??
			viewData.categories?.find((c) => c.id === selectedId)
	);
	let selectedSeries = $derived(viewData.series?.find((s) => s.id === selectedId));
	// Layers/nodes/categories use `label`; series use `name`.
	let selLabel = $derived(selectedItem?.label ?? selectedSeries?.name ?? '');
	let selColor = $derived(
		selectedItem?.color ?? selectedSeries?.color ?? 'var(--accent-primary, #00a5cf)'
	);
	let panelHtml = $derived(
		selectedItem && 'panel' in selectedItem && selectedItem.panel
			? (marked.parse(selectedItem.panel, { async: false }) as string)
			: ''
	);
	// Node lookup reads viewData.nodes, so sankey/treemap selections resolve to
	// 'node' and reuse the node panel + drill-affordance path.
	let selectedKind = $derived(
		viewData.layers?.some((l) => l.id === selectedId)
			? 'layer'
			: viewData.nodes?.some((n) => n.id === selectedId)
				? 'node'
				: viewData.categories?.some((c) => c.id === selectedId)
					? 'category'
					: viewData.series?.some((s) => s.id === selectedId)
						? 'series'
						: null
	);

	// --- Extended selection (graph/tree edge + group) ---
	let selectedEdge = $derived.by<VizEdge | undefined>(() => {
		if (!selectedEdgeKey) return undefined;
		const [source, target] = selectedEdgeKey.split('>');
		return (viewData.edges ?? []).find(
			(e) => e.source === source && e.target === target
		);
	});
	let selectedGroup = $derived.by<VizGroup | undefined>(() =>
		selectedGroupId ? (viewData.groups ?? []).find((g) => g.id === selectedGroupId) : undefined
	);

	// Heatmap readout (read-only): x/y labels + value for the selected cell.
	let selectedCellReadout = $derived.by(() => {
		if (!isHeatmap || !selectedCell) return null;
		const m = viewData.matrix;
		if (!m) return null;
		const { x, y } = selectedCell;
		return {
			xLabel: m.xLabels?.[x] ?? `#${x}`,
			yLabel: m.yLabels?.[y] ?? `#${y}`,
			value: m.values?.[y]?.[x] ?? null,
			unit: m.unit ?? ''
		};
	});
	// Timeline readout (read-only): the selected track's label.
	let selectedTrack = $derived.by(() =>
		isTimeline && selectedId ? (viewData.timeline ?? []).find((t) => t.id === selectedId) : undefined
	);

	// --- Drill-down link resolution ---
	// The selected layer/node may carry a `.link` to another scene (C4 zoom).
	let selectedLink = $derived(
		selectedItem && 'link' in selectedItem ? selectedItem.link : undefined
	);
	let linkTarget = $derived(
		selectedLink ? (allScenes().find((s) => s.id === selectedLink!.sceneId) ?? null) : null
	);
	let drillLabel = $derived(
		selectedLink?.label ?? selectedItem?.label ?? linkTarget?.name ?? 'scene'
	);

	function clearSelection() {
		selectedId = null;
		selectedEdgeKey = null;
		selectedGroupId = null;
		selectedCell = null;
	}

	function drillInto() {
		if (!selectedLink || !linkTarget) return;
		navStack = [...navStack, linkTarget];
		clearSelection();
		sceneSettingsOpen = false;
	}

	// Breadcrumb trail: base scene → … → current. Index 0 = base `scene`.
	let crumbs = $derived([scene, ...navStack]);

	function gotoCrumb(depth: number) {
		// depth 0 = base scene (empty navStack); depth N = navStack truncated to N.
		navStack = navStack.slice(0, depth);
		clearSelection();
		sceneSettingsOpen = false;
	}

	function popCrumb() {
		if (navStack.length === 0) return;
		navStack = navStack.slice(0, -1);
		clearSelection();
		sceneSettingsOpen = false;
	}

	// Remount ONLY the primitive (not the inspector) on a STRUCTURAL change — stack:
	// layer add/remove/recolor/reorder; graph: node/edge add/remove. Labels, panels,
	// groups, and label-style are read live by the primitives, so editing those
	// doesn't churn the canvas (and the inspector keeps focus).
	let canvasKey = $derived.by(() => {
		// Distinct scene identity must reset the canvas across a drill-in/out.
		const base = activeScene.id;
		const p = activeScene.primitive;
		// Refresh (live re-resolve) must always remount. Reads viewData so live
		// adapter output changes also drive a remount.
		const nonce = `#r${refreshNonce}`;
		if (p === 'graph' || p === 'tree' || p === 'sankey' || p === 'treemap') {
			// Sankey/treemap reuse the graph node/edge hash.
			const ns = (viewData.nodes ?? []).map((n) => n.id).join('|');
			const es = (viewData.edges ?? []).map((e) => `${e.source}>${e.target}`).join(',');
			const gs = (viewData.groups ?? []).map((g) => g.id).join('|');
			return `${base}#${ns}#${es}#${gs}#${activeScene.dimension}${nonce}`;
		}
		if (p === 'heatmap') {
			const m = viewData.matrix;
			const dims = `${m?.xLabels?.length ?? 0}x${m?.yLabels?.length ?? 0}`;
			const th = (m?.thresholds ?? []).length;
			return `${base}#heatmap#${dims}#t${th}${nonce}`;
		}
		if (p === 'timeline') {
			const ts = (viewData.timeline ?? []).map((t) => t.id).join('|');
			return `${base}#timeline#${ts}${nonce}`;
		}
		if (p === 'bar' || p === 'pie') {
			return base + '#cat#' + (viewData.categories ?? []).map((c) => c.id).join('|') + nonce;
		}
		if (p === 'line' || p === 'area' || p === 'scatter') {
			// Point/color edits read live; only add/remove of a series resets.
			return base + '#series#' + (viewData.series ?? []).map((s) => s.id).join('|') + '#' + p + nonce;
		}
		if (p === 'stat' || p === 'gauge' || p === 'bullet') {
			// Value/threshold edits are read live by the renderer — no remount needed.
			return base + '#scalar' + nonce;
		}
		if (p === 'table') {
			return base + '#table#' + (viewData.tabular?.columns ?? []).map((c) => c.key).join('|') + nonce;
		}
		return (
			base +
			'#' +
			(viewData.layers ?? []).map((l) => `${l.id}:${l.color}`).join('|') +
			'#' +
			JSON.stringify(activeScene.style?.environment ?? {}) +
			'#' +
			viewNonce +
			nonce
		);
	});

	function select(id: string | null) {
		selectedId = id;
		selectedEdgeKey = null;
		selectedGroupId = null;
		selectedCell = null;
	}
	function selectEdge(e: { source: string; target: string }) {
		selectedEdgeKey = `${e.source}>${e.target}`;
		selectedId = null;
		selectedGroupId = null;
		selectedCell = null;
	}
	function selectGroup(id: string) {
		selectedGroupId = id;
		selectedId = null;
		selectedEdgeKey = null;
		selectedCell = null;
	}
	// Heatmap cell selection — clears the other selection kinds.
	function selectCell(c: { x: number; y: number } | null) {
		selectedCell = c;
		selectedId = null;
		selectedEdgeKey = null;
		selectedGroupId = null;
	}
	function refreshLive() {
		refreshNonce++;
	}

	// PxP MVP port: the 9realms right-click context menu (OdinContextMenu) was
	// stripped on copy-in. Its actions are surfaced instead as a small floating
	// toolbar over the canvas (see `.canvas-tools` below) — "Add <item>", plus the
	// stack-only view toggles (wireframe / grid / auto-rotate), Reset view, and
	// Scene settings. Per-item duplicate/delete remain available in the right-hand
	// inspectors (each exposes its own delete), so no editing capability is lost.
	let addNoun = $derived(
		activeScene.primitive === 'stack'
			? 'layer'
			: isCategoryChart
				? 'category'
				: isSeriesChart
					? 'series'
					: 'node'
	);

	// Immutable env patch so reactivity + autosave fire (canvasKey for stack includes
	// JSON.stringify(environment), so toggling these remounts the canvas correctly).
	function setEnv(patch: Partial<SceneEnvironment>) {
		activeScene.style = {
			...(activeScene.style ?? {}),
			environment: { ...(activeScene.style?.environment ?? {}), ...patch }
		};
	}
	function openSceneSettings() {
		select(null);
		sceneSettingsOpen = true;
	}
	// Reset view: bump the remount nonce so canvasKey changes and StackScene
	// rebuilds at its default camera framing (no env mutation / autosave churn).
	function resetView() {
		select(null);
		viewNonce++;
	}
	function addItemHere() {
		const stamp = Date.now().toString(36);
		if (activeScene.primitive === 'stack') {
			activeScene.data.layers = [
				...(activeScene.data.layers ?? []),
				{ id: `layer-${stamp}`, label: 'New Layer', color: '#4d7cff', panel: '' }
			];
		} else if (isCategoryChart) {
			activeScene.data.categories = [
				...(activeScene.data.categories ?? []),
				{ id: `cat-${stamp}`, label: 'New Category', value: 0 }
			];
		} else if (isSeriesChart) {
			const len = activeScene.data.series?.[0]?.points.length ?? 5;
			activeScene.data.series = [
				...(activeScene.data.series ?? []),
				{
					id: `series-${stamp}`,
					name: 'New Series',
					points: Array.from({ length: len }, (_, k) => ({ x: k, y: 0 }))
				}
			];
		} else {
			activeScene.data.nodes = [
				...(activeScene.data.nodes ?? []),
				{ id: `node-${stamp}`, label: 'New Node', color: '#4d7cff', panel: '' }
			];
		}
	}
</script>

{#snippet drillAffordance()}
	{#if linkTarget}
		<button class="drill-btn" onclick={drillInto} type="button">
			Drill into {drillLabel}
			<ChevronRight size={14} strokeWidth={2} />
		</button>
	{:else}
		<p class="drill-missing">Linked scene not found.</p>
	{/if}
{/snippet}

<div class="viewer">
	<div class="canvas-area" role="presentation">
		{#if sceneIsLive(activeScene)}
			<div class="live-bar" aria-live="polite">
				<span class="live-badge" class:loading={liveLoading}>
					<span class="live-dot"></span>
					{liveLoading ? 'Syncing…' : 'Live'}
				</span>
				<button
					class="live-refresh"
					type="button"
					onclick={refreshLive}
					title="Refresh live data"
					aria-label="Refresh live data"
					disabled={liveLoading}
				>
					<RefreshCw size={13} strokeWidth={2} class={liveLoading ? 'spin' : ''} />
					Refresh
				</button>
			</div>
		{/if}
		{#if navStack.length > 0}
			<nav class="breadcrumbs" aria-label="Drill-down trail">
				<button class="crumb-back" onclick={popCrumb} title="Back" aria-label="Back">
					<ChevronLeft size={14} strokeWidth={2} />
				</button>
				{#each crumbs as crumb, i (i)}
					{#if i > 0}
						<ChevronRight size={12} strokeWidth={2} class="crumb-sep" />
					{/if}
					{#if i === crumbs.length - 1}
						<span class="crumb current" aria-current="page">{crumb.name}</span>
					{:else}
						<button class="crumb" onclick={() => gotoCrumb(i)}>{crumb.name}</button>
					{/if}
				{/each}
			</nav>
		{/if}
		{#snippet viz()}
			{#key canvasKey}
				{#if activeScene.primitive === 'stack'}
					<StackScene
						bind:this={vizRef}
						layers={viewData.layers ?? []}
						defaultLabelStyle={activeScene.style?.defaultLabelStyle}
						environment={activeScene.style?.environment}
						{selectedId}
						onSelect={select}
					/>
				{:else if is3dGraph}
					<Graph3DScene
						bind:this={vizRef}
						nodes={viewData.nodes ?? []}
						edges={viewData.edges ?? []}
						groups={viewData.groups}
						{selectedId}
						onSelect={select}
					/>
				{:else if activeScene.primitive === 'graph' || activeScene.primitive === 'tree'}
					<GraphScene
						bind:this={vizRef}
						nodes={viewData.nodes ?? []}
						edges={viewData.edges ?? []}
						groups={viewData.groups}
						{selectedId}
						{selectedEdgeKey}
						{selectedGroupId}
						onSelect={select}
						onSelectEdge={selectEdge}
						onSelectGroup={selectGroup}
						editable={canEdit}
						onConnect={(source, target) => {
							const exists = (activeScene.data.edges ?? []).some(
								(e) => e.source === source && e.target === target
							);
							if (!exists)
								activeScene.data.edges = [...(activeScene.data.edges ?? []), { source, target }];
						}}
						onDisconnect={(edge) => {
							activeScene.data.edges = (activeScene.data.edges ?? []).filter(
								(e) => !(e.source === edge.source && e.target === edge.target)
							);
						}}
					/>
				{:else if activeScene.primitive === 'bar'}
					<BarScene
						bind:this={vizRef}
						categories={viewData.categories ?? []}
						{selectedId}
						onSelect={select}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'pie'}
					<PieScene
						bind:this={vizRef}
						categories={viewData.categories ?? []}
						{selectedId}
						onSelect={select}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'stat'}
					<StatScene
						bind:this={vizRef}
						scalar={viewData.scalar ?? { value: 0 }}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'gauge'}
					<GaugeScene
						bind:this={vizRef}
						scalar={viewData.scalar ?? { value: 0 }}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'bullet'}
					<BulletScene
						bind:this={vizRef}
						scalar={viewData.scalar ?? { value: 0 }}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'line' || activeScene.primitive === 'area' || activeScene.primitive === 'scatter'}
					<LineScene
						bind:this={vizRef}
						series={viewData.series ?? []}
						mode={lineMode}
						stacked={activeScene.style?.stacked ?? false}
						showDots={activeScene.style?.showDots ?? false}
						{selectedId}
						onSelect={select}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'radar'}
					<RadarScene
						bind:this={vizRef}
						radar={viewData.radar ?? { axes: [], series: [] }}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'table'}
					<TableScene
						bind:this={vizRef}
						tabular={viewData.tabular ?? { columns: [], rows: [] }}
						tableStyle={activeScene.style?.table}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'heatmap'}
					<HeatmapScene
						bind:this={vizRef}
						matrix={viewData.matrix ?? { xLabels: [], yLabels: [], values: [] }}
						{selectedCell}
						onSelectCell={selectCell}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'sankey'}
					<SankeyScene
						bind:this={vizRef}
						nodes={viewData.nodes ?? []}
						edges={viewData.edges ?? []}
						{selectedId}
						onSelect={select}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'treemap'}
					<TreemapScene
						bind:this={vizRef}
						nodes={viewData.nodes ?? []}
						edges={viewData.edges ?? []}
						{selectedId}
						onSelect={select}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else if activeScene.primitive === 'timeline'}
					<TimelineScene
						bind:this={vizRef}
						timeline={viewData.timeline ?? []}
						{selectedId}
						onSelect={select}
						contentFont={activeScene.style?.contentFont}
					/>
				{:else}
					<div class="unsupported">
						The <strong>{activeScene.primitive}</strong> primitive isn't implemented yet.
					</div>
				{/if}
			{/key}
		{/snippet}

		{#if canEdit && supportsItems}
			<!-- PxP MVP: floating edit toolbar replaces the 9realms right-click menu. -->
			<div class="canvas-tools" role="toolbar" aria-label="Scene editing tools">
				<button type="button" class="ctool" title="Add {addNoun}" onclick={addItemHere}>
					<Plus size={13} strokeWidth={2} /> {addNoun}
				</button>
				{#if activeScene.primitive === 'stack'}
					<span class="ctool-sep"></span>
					<button
						type="button"
						class="ctool"
						class:on={activeScene.style?.environment?.wireframe}
						title="Toggle wireframe"
						onclick={() =>
							setEnv({ wireframe: !(activeScene.style?.environment?.wireframe ?? false) })}
					>
						<Box size={13} strokeWidth={2} />
					</button>
					<button
						type="button"
						class="ctool"
						class:on={activeScene.style?.environment?.showGrid !== false}
						title="Toggle grid"
						onclick={() =>
							setEnv({ showGrid: !(activeScene.style?.environment?.showGrid ?? true) })}
					>
						<Grid3x3 size={13} strokeWidth={2} />
					</button>
					<button
						type="button"
						class="ctool"
						class:on={activeScene.style?.environment?.autoRotate}
						title="Toggle auto-rotate"
						onclick={() =>
							setEnv({ autoRotate: !(activeScene.style?.environment?.autoRotate ?? false) })}
					>
						<RotateCw size={13} strokeWidth={2} />
					</button>
					<button type="button" class="ctool" title="Reset view" onclick={resetView}>
						<RefreshCw size={13} strokeWidth={2} />
					</button>
					<button type="button" class="ctool" title="Scene settings" onclick={openSceneSettings}>
						<Settings size={13} strokeWidth={2} />
					</button>
				{/if}
			</div>
			{@render viz()}
		{:else}
			{@render viz()}
		{/if}

		{#if !selectedId && !selectedEdgeKey && !selectedGroupId && !selectedCell && supportsSelectHint}
			<div class="hint">
				Click a {activeScene.primitive === 'stack'
					? 'layer'
					: activeScene.primitive === 'bar'
						? 'bar'
						: activeScene.primitive === 'pie'
							? 'slice'
							: isHeatmap
								? 'cell'
								: isTimeline
									? 'track'
									: isSeriesChart
										? 'series'
										: 'node'} to inspect it
			</div>
		{/if}
	</div>

	{#if canEdit || selectedItem || selectedSeries || selectedEdge || selectedGroup || selectedCellReadout || selectedTrack}
		<aside class="panel">
			<header>
				{#if selectedItem || selectedSeries}
					<span class="swatch" style="background: {selColor};"></span>
					<h3>{selLabel}</h3>
					<button class="close" onclick={() => clearSelection()} aria-label="Close">
						<X size={16} strokeWidth={1.75} />
					</button>
				{:else if selectedCellReadout}
					<h3>Cell</h3>
					<button class="close" onclick={() => clearSelection()} aria-label="Close">
						<X size={16} strokeWidth={1.75} />
					</button>
				{:else if selectedTrack}
					<h3>{selectedTrack.label}</h3>
					<button class="close" onclick={() => clearSelection()} aria-label="Close">
						<X size={16} strokeWidth={1.75} />
					</button>
				{:else if selectedGroup}
					<span
						class="swatch"
						style="background: {selectedGroup.color ?? 'var(--accent-primary, #00a5cf)'};"
					></span>
					<h3>{selectedGroup.label}</h3>
					<button class="close" onclick={() => clearSelection()} aria-label="Close">
						<X size={16} strokeWidth={1.75} />
					</button>
				{:else if selectedEdge}
					<h3>{selectedEdge.source} → {selectedEdge.target}</h3>
					<button class="close" onclick={() => clearSelection()} aria-label="Close">
						<X size={16} strokeWidth={1.75} />
					</button>
				{:else}
					<h3>Scene</h3>
					{#if canEdit && (activeScene.primitive === 'stack' || isSeriesChart || isTable)}
						<button
							class="close"
							class:active={sceneSettingsOpen}
							onclick={() => (sceneSettingsOpen = !sceneSettingsOpen)}
							aria-label="Scene settings"
							title="Scene settings"
						>
							<Settings size={16} strokeWidth={1.75} />
						</button>
					{/if}
				{/if}
			</header>
			{#if selectedCellReadout}
				<!-- Heatmap cell: tiny read-only readout (no inspector this wave). -->
				<div class="panel-body scene-insp">
					<div class="kv"><span>Column</span><strong>{selectedCellReadout.xLabel}</strong></div>
					<div class="kv"><span>Row</span><strong>{selectedCellReadout.yLabel}</strong></div>
					<div class="kv">
						<span>Value</span>
						<strong>
							{selectedCellReadout.value === null
								? '—'
								: `${selectedCellReadout.value}${selectedCellReadout.unit}`}
						</strong>
					</div>
				</div>
			{:else if selectedTrack}
				<!-- Timeline track: read-only label + segment count. -->
				<div class="panel-body scene-insp">
					<div class="kv"><span>Track</span><strong>{selectedTrack.label}</strong></div>
					<div class="kv"><span>Segments</span><strong>{selectedTrack.segments.length}</strong></div>
				</div>
			{:else if selectedEdge}
				<!-- Edge selection: editable inspector at base depth, summary otherwise. -->
				{#if canEdit}
					<div class="panel-body">
						<EdgeInspector
							scene={activeScene}
							edgeKey={selectedEdgeKey!}
							onDelete={() => (selectedEdgeKey = null)}
						/>
					</div>
				{:else}
					<div class="panel-body scene-insp">
						<div class="kv">
							<span>Kind</span>
							<strong>{selectedEdge.kind ?? 'default'}</strong>
						</div>
						{#if selectedEdge.label}
							<div class="kv"><span>Label</span><strong>{selectedEdge.label}</strong></div>
						{/if}
						{#if selectedEdge.animated}
							<div class="kv"><span>Flow</span><strong>animated</strong></div>
						{/if}
					</div>
				{/if}
			{:else if selectedGroup}
				<!-- Group selection: editable inspector at base depth, summary otherwise. -->
				{#if canEdit}
					<div class="panel-body">
						<GroupInspector scene={activeScene} id={selectedGroupId!} />
					</div>
				{:else}
					<div class="panel-body scene-insp">
						<div class="kv"><span>Group</span><strong>{selectedGroup.label}</strong></div>
						<p class="tip">Container boundary grouping its member nodes.</p>
					</div>
				{/if}
			{:else if canEdit && selectedId && selectedKind === 'layer'}
				<div class="panel-body">
					{#if selectedLink}{@render drillAffordance()}{/if}
					<LayerInspector scene={activeScene} id={selectedId} onDelete={() => select(null)} />
				</div>
			{:else if canEdit && selectedId && selectedKind === 'node'}
				<div class="panel-body">
					{#if selectedLink}{@render drillAffordance()}{/if}
					<NodeInspector scene={activeScene} id={selectedId} onDelete={() => select(null)} />
				</div>
			{:else if canEdit && selectedId && selectedKind === 'category'}
				<div class="panel-body">
					<CategoryInspector scene={activeScene} id={selectedId} onDelete={() => select(null)} />
				</div>
			{:else if canEdit && selectedId && selectedKind === 'series'}
				<div class="panel-body">
					<SeriesInspector scene={activeScene} id={selectedId} onDelete={() => select(null)} />
				</div>
			{:else if canEdit && isScalarChart}
				<div class="panel-body">
					<ScalarInspector
						scene={activeScene}
						primitive={activeScene.primitive === 'stat' ? 'stat' : 'gauge'}
					/>
				</div>
			{:else if canEdit && sceneSettingsOpen && (activeScene.primitive === 'stack' || isSeriesChart || isTable)}
				<div class="panel-body">
					<SceneSettings scene={activeScene} />
				</div>
			{:else if canEdit && isTable}
				<div class="panel-body">
					<TableInspector scene={activeScene} />
				</div>
			{:else if canEdit}
				<div class="panel-body scene-insp">
					<label class="f">
						<span>Description</span>
						<input
							value={activeScene.description ?? ''}
							oninput={(e) => (activeScene.description = e.currentTarget.value)}
							placeholder="One-line summary"
						/>
					</label>
					<p class="tip">{tipText}</p>
				</div>
			{:else}
				<!-- Read-only: markdown panel for the selected layer/node, plus a drill button. -->
				<div class="panel-body prose prose-invert prose-sm max-w-none">
					{#if selectedLink}{@render drillAffordance()}{/if}
					{@html panelHtml}
				</div>
			{/if}
		</aside>
	{/if}
</div>

<style>
	.viewer {
		position: relative;
		display: flex;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}
	.canvas-area {
		position: relative;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
	/* PxP MVP edit toolbar (replaces the 9realms right-click context menu). */
	.canvas-tools {
		position: absolute;
		bottom: 0.6rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 6;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.35rem;
		background: #0f172a; /* slate-900 */
		border: 1px solid #1e293b; /* slate-800 */
		backdrop-filter: blur(8px);
		max-width: calc(100% - 1rem);
		flex-wrap: wrap;
		justify-content: center;
	}
	.ctool {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.45rem;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: capitalize;
		color: rgba(255, 255, 255, 0.75);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: color 0.12s ease, background 0.12s ease;
	}
	.ctool:hover {
		color: #fff;
		background: rgba(0, 165, 207, 0.14);
	}
	.ctool.on {
		color: var(--accent-primary, #00a5cf);
	}
	.ctool-sep {
		width: 1px;
		align-self: stretch;
		margin: 0.1rem 0.15rem;
		background: #1e293b; /* slate-800 */
	}
	.hint {
		position: absolute;
		/* Clear the global fixed service-status bar (h-7 = 1.75rem) on desktop with a
		   comfortable gap; on mobile (no bar) it just sits a little higher, which is fine. */
		bottom: calc(1.75rem + 0.75rem + env(safe-area-inset-bottom, 0px));
		left: 50%;
		transform: translateX(-50%);
		pointer-events: none;
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.4);
	}
	.unsupported {
		display: grid;
		place-items: center;
		height: 100%;
		color: rgba(255, 255, 255, 0.6);
	}
	.panel {
		width: 360px;
		max-width: 42vw;
		flex-shrink: 0;
		border-left: 1px solid #1e293b; /* slate-800 */
		background: #0f172a; /* slate-900 */
		backdrop-filter: blur(8px);
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.panel header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid #1e293b; /* slate-800 */
	}
	.swatch {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
	}
	.panel header h3 {
		flex: 1;
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #fff;
	}
	.close {
		display: grid;
		place-items: center;
		padding: 0.25rem;
		color: rgba(255, 255, 255, 0.55);
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.close:hover {
		color: #fff;
	}
	.close.active {
		color: var(--accent-primary, #00a5cf);
	}
	.panel-body {
		padding: 1rem;
		overflow-y: auto;
		font-size: 0.85rem;
		line-height: 1.55;
	}
	.scene-insp {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.scene-insp .f {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.scene-insp .f span {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #94a3b8; /* slate-400 */
	}
	.scene-insp input {
		background: #020617; /* slate-950 */
		border: 1px solid #334155; /* slate-700 */
		color: #f1f5f9;
		padding: 0.35rem 0.45rem;
		font-size: 0.8rem;
		width: 100%;
	}
	.scene-insp input:focus {
		outline: none;
		border-color: var(--accent-primary, #00a5cf);
	}
	.scene-insp .tip {
		margin: 0;
		font-size: 0.74rem;
		color: #64748b;
		line-height: 1.5;
	}
	.scene-insp .kv {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.8rem;
	}
	.scene-insp .kv span {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #94a3b8; /* slate-400 */
	}
	.scene-insp .kv strong {
		color: #f1f5f9;
		font-weight: 600;
	}

	/* Live (adapter-bound) badge + refresh, top-right of the canvas. */
	.live-bar {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 6;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.live-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.45rem;
		font-size: 0.66rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #fff;
		background: #0f172a; /* slate-900 */
		border: 1px solid var(--accent-primary, #00a5cf);
		backdrop-filter: blur(8px);
	}
	.live-dot {
		width: 6px;
		height: 6px;
		background: var(--accent-primary, #00a5cf);
		box-shadow: 0 0 6px var(--accent-primary, #00a5cf);
	}
	.live-badge.loading .live-dot {
		animation: live-pulse 1s ease-in-out infinite;
	}
	@keyframes live-pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 1;
		}
	}
	.live-refresh {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.45rem;
		font-size: 0.66rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: rgba(255, 255, 255, 0.8);
		background: #0f172a; /* slate-900 */
		border: 1px solid #1e293b; /* slate-800 */
		backdrop-filter: blur(8px);
		cursor: pointer;
	}
	.live-refresh:hover:not(:disabled) {
		color: #fff;
		border-color: var(--accent-primary, #00a5cf);
	}
	.live-refresh:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.live-refresh :global(.spin) {
		animation: live-spin 0.9s linear infinite;
	}
	@keyframes live-spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Drill-down breadcrumb trail (top-left of the canvas). */
	.breadcrumbs {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		max-width: calc(100% - 1rem);
		flex-wrap: wrap;
		padding: 0.25rem 0.4rem;
		background: #0f172a; /* slate-900 */
		border: 1px solid #1e293b; /* slate-800 */
		backdrop-filter: blur(8px);
		font-size: 0.72rem;
	}
	.breadcrumbs :global(.crumb-sep) {
		color: rgba(255, 255, 255, 0.35);
		flex-shrink: 0;
	}
	.crumb-back {
		display: grid;
		place-items: center;
		padding: 0.15rem;
		margin-right: 0.15rem;
		color: rgba(255, 255, 255, 0.65);
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.crumb-back:hover {
		color: #fff;
	}
	.crumb {
		padding: 0.1rem 0.3rem;
		color: rgba(255, 255, 255, 0.6);
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: inherit;
		white-space: nowrap;
	}
	button.crumb:hover {
		color: var(--accent-primary, #00a5cf);
	}
	.crumb.current {
		color: #fff;
		font-weight: 600;
		cursor: default;
	}

	/* Drill-into CTA in the panel (navigation action, both modes). */
	.drill-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		width: 100%;
		margin-bottom: 0.85rem;
		padding: 0.5rem 0.6rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: #020617; /* slate-950 — dark text on accent fill */
		background: var(--accent-primary, #00a5cf);
		border: 1px solid var(--accent-primary, #00a5cf);
		cursor: pointer;
		transition: opacity 0.15s ease;
	}
	.drill-btn:hover {
		opacity: 0.9;
	}
	.drill-missing {
		margin: 0 0 0.85rem;
		padding: 0.45rem 0.55rem;
		font-size: 0.74rem;
		color: #64748b; /* slate-500 */
		border: 1px dashed #334155; /* slate-700 */
	}

	/* Mobile: stack canvas over inspector so the canvas stays usable on narrow
	   screens (≤ 640px). The panel becomes a bottom drawer with a capped height. */
	@media (max-width: 640px) {
		.viewer {
			flex-direction: column;
		}
		.panel {
			width: 100%;
			max-width: 100%;
			max-height: 45%;
			border-left: none;
			border-top: 1px solid #1e293b; /* slate-800 */
		}
	}
</style>

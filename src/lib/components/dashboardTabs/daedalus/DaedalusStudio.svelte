<script lang="ts">
	// DAEDALUS studio — scene library + always-on authoring. Built-in scenes are
	// read-only templates; user scenes (localStorage) are live-editable + autosaved.
	// Scene management (duplicate / delete) lives in the dropdown; new scenes are
	// created from a primitive-picker dialog.
	import {
		Shapes,
		Plus,
		Trash2,
		Copy,
		Layers,
		Network,
		GitBranch,
		Grid3x3,
		Download,
		Image,
		FileText,
		FileJson,
		Loader2,
		Hash,
		Gauge,
		Target,
		BarChart3,
		PieChart,
		Radar,
		LineChart,
		AreaChart,
		ScatterChart,
		Table,
		Spline,
		SquareChartGantt,
		LayoutGrid,
		Search,
		PanelLeftClose,
		PanelLeftOpen,
		Maximize2,
		Minimize2
	} from 'lucide-svelte';
	import { marked } from 'marked';
	import { toast } from 'svelte-sonner';
	import DaedalusViewer from '$lib/daedalus/DaedalusViewer.svelte';
	import * as Dialog from '$lib/components/shadcn/ui/dialog';
	import { onMount } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import {
		isReadOnly,
		newStackScene,
		newGraphScene,
		newTreeScene,
		newStatScene,
		newGaugeScene,
		newBulletScene,
		newBarScene,
		newPieScene,
		newRadarScene,
		newLineScene,
		newAreaScene,
		newScatterScene,
		newTableScene,
		newHeatmapScene,
		newSankeyScene,
		newTimelineScene,
		newTreemapScene,
		BUILTIN_SCENES,
		TEMPLATE_SCENES
	} from '$lib/daedalus/library';
	import {
		loadStore,
		persistScene,
		removeScene,
		allFolderPaths,
		type StoreSource
	} from '$lib/daedalus/store';
	import type { SceneDoc, VizPrimitive } from '$lib/daedalus/schema';

	let { supabase = null }: { supabase?: SupabaseClient | null } = $props();

	// PxP MVP port: local no-op fullscreen stub. The 9realms build shared a global
	// chatFullscreen store with BifrostChat ($lib/stores/chatFullscreen.svelte),
	// which doesn't exist in PxP. Here fullscreen is component-local — the `.studio`
	// `.fullscreen` class still expands the viewer within the dashboard panel.
	let isFullscreenState = $state(false);
	function setFullscreen(v: boolean) {
		isFullscreenState = v;
	}
	function toggleFullscreen() {
		isFullscreenState = !isFullscreenState;
	}

	let userScenes = $state<SceneDoc[]>([]);
	let folders = $state<string[]>([]);
	let source = $state<StoreSource>('local');
	// Everything the rail iterates and resolves ids against: built-ins (Atlas /
	// Live / Samples), the per-primitive Templates, then user scenes.
	let scenes = $derived<SceneDoc[]>([...BUILTIN_SCENES, ...TEMPLATE_SCENES, ...userScenes]);
	let selectedId = $state<string>(BUILTIN_SCENES[0]?.id ?? '');
	let selected = $derived(scenes.find((s) => s.id === selectedId) ?? scenes[0]);

	let folderPaths = $derived(allFolderPaths(userScenes, folders));

	// ── Scene rail (replaces the header dropdown) ───────────────────────────────
	let railOpen = $state(true);
	let q = $state(''); // scene search
	let fullscreen = $derived(isFullscreenState);

	// Scene rail groups: ONE uniform pass over the merged set (built-ins +
	// templates + user scenes), grouped purely by each scene's `folder` field.
	// Built-ins carry folders 'Atlas' / 'Live' / 'Samples'; templates carry
	// 'Templates'; user scenes carry their own folder (or none → 'My Scenes').
	// Folder headings sort alphabetically; the search box filters by name across
	// every group and empty groups drop out.
	const ROOT_HEADING = 'My Scenes';
	let sceneGroups = $derived.by(() => {
		const ql = q.trim().toLowerCase();
		const match = (s: SceneDoc) => !ql || s.name.toLowerCase().includes(ql);

		const byFolder = new Map<string, SceneDoc[]>();
		for (const s of scenes) {
			if (!match(s)) continue;
			const f = s.folder?.trim() || '';
			const list = byFolder.get(f);
			if (list) list.push(s);
			else byFolder.set(f, [s]);
		}

		return [...byFolder.keys()]
			.sort((a, b) => a.localeCompare(b))
			.map((f) => ({
				key: f || '__root',
				heading: f || ROOT_HEADING,
				items: byFolder.get(f)!
			}));
	});

	// Pick a scene from the rail; default to View (Edit is opt-in via the toggle).
	function pickScene(id: string) {
		selectedId = id;
		editMode = false;
	}

	// Leaving the Studio (mode switch / nav) must never strand the dashboard in
	// fullscreen — mirror BifrostChat's reset-on-destroy.
	$effect(() => () => setFullscreen(false));

	async function refresh() {
		const store = await loadStore(supabase);
		userScenes = store.scenes;
		folders = store.folders;
		source = store.source;
	}
	onMount(async () => {
		// On small screens the rail is an overlay drawer (see mobile media query) —
		// start it collapsed so the canvas is immediately usable.
		if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
			railOpen = false;
		}
		await refresh();
		// Deep-link from the Scene Library: /dashboard/daedalus?scene=<id>
		const wanted = new URLSearchParams(window.location.search).get('scene');
		if (wanted && scenes.some((s) => s.id === wanted)) {
			selectedId = wanted;
			editMode = !isReadOnly(wanted);
		}
	});

	function upsertLocal(scene: SceneDoc) {
		const i = userScenes.findIndex((s) => s.id === scene.id);
		if (i >= 0) userScenes[i] = scene;
		else userScenes = [...userScenes, scene];
	}

	// Live editable copy of the selected scene.
	const initial = structuredClone(BUILTIN_SCENES[0]) as SceneDoc;
	let working = $state<SceneDoc>(initial);
	let loadedId = BUILTIN_SCENES[0]?.id ?? '';
	let loadedJson = JSON.stringify(initial);
	let sessionKey = $state(0);
	let editMode = $state(false);
	let canEdit = $derived(!isReadOnly(selectedId));

	let newSceneOpen = $state(false);
	let deleteTarget = $state<string | null>(null);
	let deleteName = $derived(scenes.find((s) => s.id === deleteTarget)?.name ?? '');

	let viewerRef = $state<{ capturePng: () => Promise<string | null> } | null>(null);
	let exporting = $state(false);
	let exportOpen = $state(false);

	// Scalar charts have no per-item adds; category/structural primitives do.
	let canAddItem = $derived(
		working.primitive !== 'stat' &&
			working.primitive !== 'gauge' &&
			working.primitive !== 'bullet' &&
			working.primitive !== 'table' &&
			working.primitive !== 'radar'
	);
	let isSeriesPrim = $derived(
		working.primitive === 'line' || working.primitive === 'area' || working.primitive === 'scatter'
	);
	let addLabel = $derived(
		working.primitive === 'stack'
			? 'Layer'
			: working.primitive === 'bar' || working.primitive === 'pie'
				? 'Category'
				: isSeriesPrim
					? 'Series'
					: 'Node'
	);

	const EXPORT_TILES = [
		{ id: 'png', label: 'PNG Image', icon: Image, desc: 'Snapshot of the current view' },
		{ id: 'pdf', label: 'Explainer PDF', icon: FileText, desc: 'Image + a page per detail panel' },
		{ id: 'json', label: 'Scene JSON', icon: FileJson, desc: 'Raw definition to re-import' }
	];

	type Tile = {
		kind: VizPrimitive;
		label: string;
		icon: typeof Layers;
		soon: boolean;
		desc: string;
		group: 'simple' | 'advanced';
	};
	const TILES: Tile[] = [
		// Simple — quantitative charts
		{ kind: 'stat', label: 'Stat', icon: Hash, soon: false, desc: 'Big number', group: 'simple' },
		{ kind: 'gauge', label: 'Gauge', icon: Gauge, soon: false, desc: 'Value vs. range', group: 'simple' },
		{ kind: 'bullet', label: 'Bullet', icon: Target, soon: false, desc: 'KPI vs. target', group: 'simple' },
		{ kind: 'bar', label: 'Bar', icon: BarChart3, soon: false, desc: 'Compare values', group: 'simple' },
		{ kind: 'pie', label: 'Pie', icon: PieChart, soon: false, desc: 'Part of whole', group: 'simple' },
		{ kind: 'radar', label: 'Radar', icon: Radar, soon: false, desc: 'Multi-axis profile', group: 'simple' },
		{ kind: 'line', label: 'Line', icon: LineChart, soon: false, desc: 'Trend over time', group: 'simple' },
		{ kind: 'area', label: 'Area', icon: AreaChart, soon: false, desc: 'Trend + volume', group: 'simple' },
		{ kind: 'scatter', label: 'Scatter', icon: ScatterChart, soon: false, desc: 'X/Y correlation', group: 'simple' },
		// Advanced — structural / systems
		{ kind: 'stack', label: '3D Stack', icon: Layers, soon: false, desc: 'Layered cylinders', group: 'advanced' },
		{ kind: 'graph', label: 'Node Graph', icon: Network, soon: false, desc: 'Nodes & edges', group: 'advanced' },
		{ kind: 'tree', label: 'Tree', icon: GitBranch, soon: false, desc: 'Hierarchy', group: 'advanced' },
		{ kind: 'heatmap', label: 'Heatmap', icon: Grid3x3, soon: false, desc: 'Metrics grid', group: 'advanced' },
		{ kind: 'sankey', label: 'Sankey', icon: Spline, soon: false, desc: 'Flow & magnitude', group: 'advanced' },
		{ kind: 'timeline', label: 'Timeline', icon: SquareChartGantt, soon: false, desc: 'State over time', group: 'advanced' },
		{ kind: 'treemap', label: 'Treemap', icon: LayoutGrid, soon: false, desc: 'Nested proportion', group: 'advanced' },
		{ kind: 'table', label: 'Table', icon: Table, soon: false, desc: 'Rows & columns', group: 'advanced' }
	];
	const SIMPLE_TILES = TILES.filter((t) => t.group === 'simple');
	const ADVANCED_TILES = TILES.filter((t) => t.group === 'advanced');

	// Reload the working copy when the selected scene actually changes.
	$effect(() => {
		if (selectedId !== loadedId) {
			loadedId = selectedId;
			const snap = structuredClone($state.snapshot(selected)) as SceneDoc;
			working = snap;
			loadedJson = JSON.stringify(snap);
			sessionKey++;
		}
	});

	// Debounced autosave for USER scenes only (built-ins are never persisted).
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const json = JSON.stringify($state.snapshot(working));
		if (json === loadedJson) return;
		if (isReadOnly(working.id)) {
			loadedJson = json;
			return;
		}
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			const scene = JSON.parse(json) as SceneDoc;
			persistScene(supabase, source, scene);
			upsertLocal(scene);
			loadedJson = json;
		}, 500);
	});

	function addItem() {
		const stamp = Date.now().toString(36);
		if (working.primitive === 'stack') {
			working.data.layers = [
				...(working.data.layers ?? []),
				{ id: `layer-${stamp}`, label: 'New Layer', color: '#4d7cff', panel: '' }
			];
		} else if (working.primitive === 'bar' || working.primitive === 'pie') {
			working.data.categories = [
				...(working.data.categories ?? []),
				{ id: `cat-${stamp}`, label: 'New Category', value: 0 }
			];
		} else if (isSeriesPrim) {
			const len = working.data.series?.[0]?.points.length ?? 5;
			working.data.series = [
				...(working.data.series ?? []),
				{
					id: `series-${stamp}`,
					name: 'New Series',
					points: Array.from({ length: len }, (_, k) => ({ x: k, y: 0 }))
				}
			];
		} else {
			working.data.nodes = [
				...(working.data.nodes ?? []),
				{ id: `node-${stamp}`, label: 'New Node', color: '#4d7cff', panel: '' }
			];
		}
	}
	const SCENE_FACTORY: Record<string, () => SceneDoc> = {
		stack: newStackScene,
		graph: newGraphScene,
		tree: newTreeScene,
		stat: newStatScene,
		gauge: newGaugeScene,
		bullet: newBulletScene,
		bar: newBarScene,
		pie: newPieScene,
		radar: newRadarScene,
		line: newLineScene,
		area: newAreaScene,
		scatter: newScatterScene,
		table: newTableScene,
		heatmap: newHeatmapScene,
		sankey: newSankeyScene,
		timeline: newTimelineScene,
		treemap: newTreemapScene
	};
	function createScene(kind: VizPrimitive) {
		const make = SCENE_FACTORY[kind] ?? newStackScene;
		const s = make();
		persistScene(supabase, source, s);
		upsertLocal(s);
		selectedId = s.id;
		editMode = true;
		newSceneOpen = false;
	}
	function duplicateScene(id: string) {
		const src = scenes.find((s) => s.id === id);
		if (!src) return;
		const copy = structuredClone($state.snapshot(src)) as SceneDoc;
		const newId = `user-${Date.now().toString(36)}`;
		copy.id = newId;
		copy.slug = newId;
		copy.name = `${copy.name} (copy)`;
		persistScene(supabase, source, copy);
		upsertLocal(copy);
		selectedId = newId;
		editMode = true;
	}
	function confirmDelete() {
		const id = deleteTarget;
		deleteTarget = null;
		if (!id || isReadOnly(id)) return;
		removeScene(supabase, source, id);
		userScenes = userScenes.filter((s) => s.id !== id);
		if (selectedId === id) selectedId = scenes[0]?.id ?? '';
	}

	function triggerDownload(href: string, filename: string) {
		const a = document.createElement('a');
		a.href = href;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}
	async function exportPng() {
		if (exporting) return;
		exporting = true;
		try {
			const img = await viewerRef?.capturePng();
			if (img) triggerDownload(img, `${working.slug}.png`);
		} finally {
			exporting = false;
		}
	}
	async function exportPdf() {
		if (exporting) return;
		exporting = true;
		const image = await viewerRef?.capturePng();
		if (!image) {
			exporting = false;
			return;
		}
		try {
			const items = (working.data.layers ?? working.data.nodes ?? []) as Array<{
				label: string;
				color?: string;
				sublabel?: string;
				panel?: string;
			}>;
			const layers = items.map((it) => ({
				label: it.label,
				sublabel: it.sublabel ?? '',
				color: it.color ?? '#00a5cf',
				html: it.panel ? (marked.parse(it.panel, { async: false }) as string) : ''
			}));
			const res = await fetch('/api/daedalus/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: working.name,
					description: working.description ?? '',
					image,
					layers
				})
			});
			if (!res.ok) throw new Error(`Export failed (${res.status})`);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			triggerDownload(url, `${working.slug}.pdf`);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('[daedalus] PDF export failed', err);
			toast.error('PDF export failed — try again, or use PNG / JSON.');
		} finally {
			exporting = false;
		}
	}
	function exportJson() {
		const blob = new Blob([JSON.stringify($state.snapshot(working), null, 2)], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);
		triggerDownload(url, `${working.slug}.json`);
		URL.revokeObjectURL(url);
	}
	function runExport(id: string) {
		exportOpen = false;
		if (id === 'png') exportPng();
		else if (id === 'pdf') exportPdf();
		else if (id === 'json') exportJson();
	}
</script>

<div class="studio" class:fullscreen>
	<aside class="rail" class:collapsed={!railOpen}>
		{#if railOpen}
			<div class="rail-top">
				<div class="rail-search">
					<Search size={13} strokeWidth={2} />
					<input bind:value={q} placeholder="Search scenes" aria-label="Search scenes" />
				</div>
				<button
					class="rail-tog"
					title="Collapse panel"
					aria-label="Collapse panel"
					onclick={() => (railOpen = false)}
				>
					<PanelLeftClose size={15} strokeWidth={1.75} />
				</button>
			</div>
			<div class="rail-list">
				{#each sceneGroups as g (g.key)}
					<div class="rail-group">
						<span class="rail-heading">{g.heading}</span>
						{#each g.items as s (s.id)}
							<div
								class="rail-item"
								class:active={s.id === selectedId}
								role="button"
								tabindex="0"
								title={s.name}
								onclick={() => pickScene(s.id)}
								onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && pickScene(s.id)}
							>
								<span class="rail-name">{s.name}</span>
								<span class="rail-acts">
									<button
										class="opt-ic"
										title="Duplicate"
										aria-label="Duplicate {s.name}"
										onclick={(e) => {
											e.stopPropagation();
											duplicateScene(s.id);
										}}
									>
										<Copy size={12} strokeWidth={2} />
									</button>
									{#if !isReadOnly(s.id)}
										<button
											class="opt-ic danger"
											title="Delete"
											aria-label="Delete {s.name}"
											onclick={(e) => {
												e.stopPropagation();
												deleteTarget = s.id;
											}}
										>
											<Trash2 size={12} strokeWidth={2} />
										</button>
									{/if}
								</span>
							</div>
						{/each}
					</div>
				{/each}
				{#if sceneGroups.length === 0}
					<p class="rail-empty">No scenes match.</p>
				{/if}
			</div>
			<button class="rail-new" onclick={() => (newSceneOpen = true)}>
				<Plus size={13} strokeWidth={2} /> New Scene
			</button>
		{:else}
			<button
				class="rail-exp"
				title="Show scenes"
				aria-label="Show scenes"
				onclick={() => (railOpen = true)}
			>
				<PanelLeftOpen size={16} strokeWidth={1.75} />
			</button>
		{/if}
	</aside>

	<div class="main">
		<header class="studio-header">
			<Shapes size={15} strokeWidth={1.75} class="text-[var(--accent-primary)]" />
		{#if canEdit && editMode}
			<input class="name-input" bind:value={working.name} placeholder="Scene name" />
		{:else}
			<h2 class="title">{working.name}</h2>
			{#if working.description}<span class="desc">{working.description}</span>{/if}
			{#if !canEdit}<span class="ro-badge">Template · read-only</span>{/if}
		{/if}
		<div class="actions">
			{#if canEdit}
				<div class="toggle">
					<button class:active={!editMode} onclick={() => (editMode = false)}>View</button>
					<button class:active={editMode} onclick={() => (editMode = true)}>Edit</button>
				</div>
			{/if}
			{#if canEdit && editMode && canAddItem}
				<button onclick={addItem} title="Add a {addLabel.toLowerCase()}">
					<Plus size={13} strokeWidth={2} />
					{addLabel}
				</button>
			{/if}
			<button class="primary" onclick={() => (newSceneOpen = true)}>
				<Plus size={13} strokeWidth={2} /> New Scene
			</button>
			<span class="divider"></span>
			<button onclick={() => (exportOpen = true)} disabled={exporting} title="Export this scene">
				{#if exporting}
					<Loader2 size={13} strokeWidth={2} class="spin" />
				{:else}
					<Download size={13} strokeWidth={2} />
				{/if}
				Export
			</button>
			<span class="divider"></span>
			<button
				onclick={toggleFullscreen}
				title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
				aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
			>
				{#if fullscreen}
					<Minimize2 size={13} strokeWidth={2} />
				{:else}
					<Maximize2 size={13} strokeWidth={2} />
				{/if}
			</button>
		</div>
	</header>

		<div class="stage">
			{#key sessionKey}
				<DaedalusViewer bind:this={viewerRef} scene={working} editable={editMode && canEdit} />
			{/key}
		</div>
	</div>
</div>

{#snippet tileGroup(title: string, tiles: Tile[])}
	<div class="tile-group">
		<span class="group-title">{title}</span>
		<div class="tile-grid">
			{#each tiles as t (t.kind)}
				{@const Icon = t.icon}
				<button
					class="tile"
					class:soon={t.soon}
					disabled={t.soon}
					onclick={() => !t.soon && createScene(t.kind)}
				>
					<Icon size={18} strokeWidth={1.5} />
					<span class="tile-label">{t.label}</span>
					<span class="tile-desc">{t.desc}</span>
					{#if t.soon}<span class="tile-soon">Soon</span>{/if}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

<!-- New scene: primitive picker -->
<Dialog.Root bind:open={newSceneOpen}>
	<Dialog.Content
		class="max-h-[90vh] w-full max-w-lg overflow-y-auto"
		style="background: #0f172a; border-color: #1e293b; color: #e5e7eb;"
	>
		<Dialog.Header>
			<Dialog.Title class="text-slate-100">New scene</Dialog.Title>
			<Dialog.Description class="text-slate-400">Choose a visualization type.</Dialog.Description>
		</Dialog.Header>
		{@render tileGroup('Simple', SIMPLE_TILES)}
		{@render tileGroup('Advanced', ADVANCED_TILES)}
	</Dialog.Content>
</Dialog.Root>

<!-- Delete confirmation -->
<Dialog.Root open={deleteTarget !== null} onOpenChange={(o) => (o ? null : (deleteTarget = null))}>
	<Dialog.Content
		class="max-h-[90vh] w-full max-w-sm overflow-y-auto"
		style="background: #0f172a; border-color: #1e293b; color: #e5e7eb;"
	>
		<Dialog.Header>
			<Dialog.Title class="text-slate-100">Delete scene?</Dialog.Title>
			<Dialog.Description class="text-slate-400"
				>“{deleteName}” will be permanently removed. This can't be undone.</Dialog.Description
			>
		</Dialog.Header>
		<Dialog.Footer>
			<button class="dlg-btn" onclick={() => (deleteTarget = null)}>Cancel</button>
			<button class="dlg-btn danger" onclick={confirmDelete}>Delete</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Export: format picker with explanations -->
<Dialog.Root bind:open={exportOpen}>
	<Dialog.Content
		class="max-h-[90vh] w-full max-w-md overflow-y-auto"
		style="background: #0f172a; border-color: #1e293b; color: #e5e7eb;"
	>
		<Dialog.Header>
			<Dialog.Title class="text-slate-100">Export scene</Dialog.Title>
			<Dialog.Description class="text-slate-400">Choose a format.</Dialog.Description>
		</Dialog.Header>
		<div class="tile-grid">
			{#each EXPORT_TILES as t (t.id)}
				{@const Icon = t.icon}
				<button class="tile" onclick={() => runExport(t.id)}>
					<Icon size={18} strokeWidth={1.5} />
					<span class="tile-label">{t.label}</span>
					<span class="tile-desc">{t.desc}</span>
				</button>
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	.studio {
		display: flex;
		flex-direction: row;
		height: 100%;
		min-height: 0;
	}
	.main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
	/* ── Scene rail (replaces the header dropdown) ───────────────────────────── */
	.rail {
		flex: none;
		width: 13.5rem;
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-right: 1px solid #1e293b; /* slate-800 */
		background: #0f172a; /* slate-900 */
		transition: width 0.18s ease;
	}
	.rail.collapsed {
		width: 2.25rem;
		align-items: center;
	}
	.rail-top {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.4rem 0.45rem;
		border-bottom: 1px solid #1e293b; /* slate-800 */
	}
	.rail-search {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
		padding: 0.3rem 0.4rem;
		background: #020617; /* slate-950 */
		border: 1px solid #334155; /* slate-700 */
	}
	.rail-search:focus-within {
		border-color: var(--accent-primary, #00a5cf);
	}
	.rail-search :global(svg) {
		color: #64748b; /* slate-500 */
		flex: none;
	}
	.rail-search input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		color: #e2e8f0; /* slate-200 */
		font-size: 0.72rem;
	}
	.rail-search input:focus {
		outline: none;
	}
	.rail-tog,
	.rail-exp {
		display: grid;
		place-items: center;
		flex: none;
		padding: 0.25rem;
		color: #94a3b8; /* slate-400 */
		background: transparent;
		border: none;
		cursor: pointer;
		transition: color 0.12s ease;
	}
	.rail-exp {
		margin-top: 0.5rem;
	}
	.rail-tog:hover,
	.rail-exp:hover {
		color: var(--accent-primary, #00a5cf);
	}
	.rail-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.35rem 0.3rem;
		scrollbar-width: thin;
		scrollbar-color: #334155 transparent; /* slate-700 */
	}
	.rail-group {
		display: flex;
		flex-direction: column;
		margin-bottom: 0.4rem;
	}
	.rail-heading {
		padding: 0.25rem 0.4rem 0.15rem;
		font-size: 0.58rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b; /* slate-500 */
	}
	.rail-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.4rem;
		color: #cbd5e1; /* slate-300 */
		cursor: pointer;
		border-left: 2px solid transparent;
		transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
	}
	.rail-item:hover {
		background: #1e293b; /* slate-800 */
		color: #fff;
	}
	.rail-item.active {
		background: #1e293b; /* slate-800 */
		border-left-color: var(--accent-primary, #00a5cf);
		color: #fff;
	}
	.rail-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.74rem;
		font-weight: 500;
	}
	.rail-acts {
		display: inline-flex;
		gap: 0.05rem;
		flex: none;
		opacity: 0;
		transition: opacity 0.12s ease;
	}
	.rail-item:hover .rail-acts,
	.rail-item.active .rail-acts {
		opacity: 1;
	}
	.rail-empty {
		padding: 1rem 0.5rem;
		font-size: 0.72rem;
		color: #64748b;
		text-align: center;
	}
	.rail-new {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		margin: 0.4rem;
		padding: 0.45rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--accent-primary, #00a5cf);
		background: #1e293b; /* slate-800 */
		border: 1px solid #334155; /* slate-700 */
		cursor: pointer;
		transition: border-color 0.12s ease;
	}
	.rail-new:hover {
		border-color: var(--accent-primary, #00a5cf);
	}
	.studio-header {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.85rem;
		border-bottom: 1px solid #1e293b; /* slate-800 */
	}
	.title {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 600;
		color: #f8fafc; /* slate-50 */
		white-space: nowrap;
		flex: none;
	}
	.desc {
		font-size: 0.72rem;
		color: #94a3b8; /* slate-400 */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.toggle {
		display: flex;
		border: 1px solid #334155; /* slate-700 */
	}
	.toggle button {
		padding: 0.3rem 0.65rem;
		font-size: 0.7rem;
		font-weight: 600;
		color: #94a3b8; /* slate-400 */
		background: #0f172a; /* slate-900 */
		border: none;
		cursor: pointer;
	}
	.toggle button.active {
		color: #020617; /* slate-950 — dark text on accent fill */
		background: var(--accent-primary, #00a5cf);
	}
	.ro-badge {
		flex: none;
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8; /* slate-400 */
		border: 1px solid #334155; /* slate-700 */
		padding: 0.1rem 0.4rem;
	}
	.name-input {
		flex: 1;
		max-width: 22rem;
		min-width: 0;
		background: #020617; /* slate-950 */
		border: 1px solid #334155; /* slate-700 */
		color: #f8fafc; /* slate-50 */
		padding: 0.3rem 0.5rem;
		font-size: 0.82rem;
		font-weight: 600;
	}
	.name-input:focus {
		outline: none;
		border-color: var(--accent-primary, #00a5cf);
	}
	.actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex: none;
	}
	.actions button {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem 0.6rem;
		font-size: 0.7rem;
		font-weight: 600;
		color: #cbd5e1; /* slate-300 */
		background: #1e293b; /* slate-800 */
		border: 1px solid #334155; /* slate-700 */
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.actions button:hover {
		color: var(--accent-primary, #00a5cf);
		border-color: var(--accent-primary, #00a5cf);
	}
	.actions button.primary {
		color: var(--accent-primary, #00a5cf);
		border-color: var(--accent-primary, #00a5cf);
	}
	.divider {
		width: 1px;
		align-self: stretch;
		margin: 0.15rem 0.3rem;
		background: #1e293b; /* slate-800 */
	}
	.actions :global(.spin) {
		animation: daedalus-spin 0.9s linear infinite;
	}
	@keyframes daedalus-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.stage {
		flex: 1;
		min-height: 0;
		display: flex;
		background: #020617; /* slate-950 */
		overflow: hidden;
	}
	.stage > :global(*) {
		flex: 1;
		min-width: 0;
	}

	/* Rail item hover actions (duplicate / delete) */
	.opt-ic {
		display: grid;
		place-items: center;
		padding: 0.2rem;
		color: #94a3b8; /* slate-400 */
		background: transparent;
		border: none;
		cursor: pointer;
		transition: color 0.12s ease;
	}
	.opt-ic:hover {
		color: var(--accent-primary, #00a5cf);
	}
	.opt-ic.danger:hover {
		color: #f87171;
	}

	/* New-scene / export primitive tiles */
	.tile-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.tile-group + .tile-group {
		margin-top: 0.85rem;
	}
	.group-title {
		font-size: 0.62rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b; /* slate-500 */
	}
	.tile-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.35rem;
		padding: 0.1rem 0;
	}
	@media (min-width: 480px) {
		.tile-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.6rem 0.3rem;
		color: #e2e8f0; /* slate-200 */
		background: #020617; /* slate-950 */
		border: 1px solid #334155; /* slate-700 */
		cursor: pointer;
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	.tile:hover:not(:disabled) {
		border-color: var(--accent-primary, #00a5cf);
		background: #1e293b; /* slate-800 */
	}
	.tile:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.tile-label {
		font-size: 0.72rem;
		font-weight: 600;
		text-align: center;
		line-height: 1.1;
	}
	.tile-desc {
		font-size: 0.56rem;
		color: #94a3b8; /* slate-400 */
		text-align: center;
		line-height: 1.15;
	}
	.tile-soon {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8; /* slate-400 */
		border: 1px solid #334155; /* slate-700 */
		padding: 0.05rem 0.3rem;
	}
	.dlg-btn {
		padding: 0.4rem 0.9rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: #e2e8f0; /* slate-200 */
		background: #1e293b; /* slate-800 */
		border: 1px solid #334155; /* slate-700 */
		cursor: pointer;
		transition: border-color 0.12s ease;
	}
	.dlg-btn:hover {
		border-color: var(--accent-primary, #00a5cf);
	}
	.dlg-btn.danger {
		color: #fecaca; /* red-200 */
		background: rgba(239, 68, 68, 0.1); /* red-500/10 */
		border-color: rgba(239, 68, 68, 0.4); /* red-500/40 */
	}
	.dlg-btn.danger:hover {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(239, 68, 68, 0.4);
	}
	.tile :global(svg) {
		color: var(--accent-primary, #00a5cf);
	}

	/* Mobile: the scene rail becomes an overlay drawer over the canvas so the
	   three-pane layout (rail / canvas / inspector) stays usable on narrow
	   screens. Expanded it floats above the stage; collapsed it's a thin strip. */
	@media (max-width: 640px) {
		.studio {
			position: relative;
		}
		.rail {
			position: absolute;
			top: 0;
			left: 0;
			bottom: 0;
			z-index: 20;
			width: 15rem;
			max-width: 80vw;
			box-shadow: 4px 0 16px rgba(0, 0, 0, 0.45);
		}
		.rail.collapsed {
			width: 2.25rem;
			box-shadow: none;
		}
		.studio-header {
			flex-wrap: wrap;
			row-gap: 0.3rem;
		}
		.actions {
			flex-wrap: wrap;
			justify-content: flex-end;
		}
		.desc {
			display: none;
		}
	}
</style>

<script lang="ts">
	// DAEDALUS Scene Library — a file browser for visualization scenes.
	// Folders are virtual (path strings, like Media Library). PxP MVP: scenes +
	// folders persist to localStorage only (see $lib/daedalus/store.ts — the DB
	// table isn't ported yet, so `source` is always 'local').
	import { goto } from '$app/navigation';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import {
		Folder,
		FolderPlus,
		FolderInput,
		Pencil,
		Copy,
		Trash2,
		ChevronRight,
		Home,
		Database,
		HardDrive,
		Shapes
	} from 'lucide-svelte';
	import * as Dialog from '$lib/components/shadcn/ui/dialog';
	import type { SceneDoc } from '$lib/daedalus/schema';
	import {
		loadStore,
		persistScene,
		removeScene,
		moveScene,
		createFolder,
		renameFolder,
		deleteFolder,
		allFolderPaths,
		normalizeFolder,
		parentFolder,
		lastSegment,
		type StoreSource
	} from '$lib/daedalus/store';

	let { supabase = null }: { supabase?: SupabaseClient | null } = $props();

	let scenes = $state<SceneDoc[]>([]);
	let folders = $state<string[]>([]);
	let source = $state<StoreSource>('local');
	let cwd = $state(''); // current folder path, '' = root

	async function refresh() {
		const store = await loadStore(supabase);
		scenes = store.scenes;
		folders = store.folders;
		source = store.source;
	}
	$effect(() => {
		refresh();
	});

	let allFolders = $derived(allFolderPaths(scenes, folders));
	// Immediate subfolders of cwd.
	let subfolders = $derived(allFolders.filter((p) => parentFolder(p) === cwd));
	let scenesHere = $derived(scenes.filter((s) => (s.folder ?? '') === cwd));
	let breadcrumbs = $derived.by(() => {
		if (!cwd) return [] as { label: string; path: string }[];
		const parts = cwd.split('/');
		let acc = '';
		return parts.map((p) => {
			acc = acc ? `${acc}/${p}` : p;
			return { label: p, path: acc };
		});
	});
	function countIn(path: string): number {
		return scenes.filter((s) => (s.folder ?? '') === path || (s.folder ?? '').startsWith(path + '/'))
			.length;
	}

	// ── dialogs ───────────────────────────────────────────────────────────────
	let newFolderOpen = $state(false);
	let newFolderName = $state('');
	let renameTarget = $state<string | null>(null);
	let renameValue = $state('');
	let moveTarget = $state<string | null>(null);
	let deleteScene = $state<SceneDoc | null>(null);
	let deleteFolderTarget = $state<string | null>(null);

	async function doNewFolder() {
		const name = normalizeFolder(newFolderName);
		newFolderOpen = false;
		newFolderName = '';
		if (!name) return;
		await createFolder(supabase, source, cwd ? `${cwd}/${name}` : name);
		await refresh();
	}
	function startRename(path: string) {
		renameTarget = path;
		renameValue = lastSegment(path);
	}
	async function doRename() {
		const path = renameTarget;
		const next = normalizeFolder(renameValue);
		renameTarget = null;
		if (!path || !next) return;
		const parent = parentFolder(path);
		await renameFolder(supabase, source, path, parent ? `${parent}/${next}` : next);
		await refresh();
	}
	async function doMove(folder: string) {
		const id = moveTarget;
		moveTarget = null;
		if (!id) return;
		await moveScene(supabase, source, id, folder);
		await refresh();
	}
	async function doDeleteScene() {
		const s = deleteScene;
		deleteScene = null;
		if (!s) return;
		await removeScene(supabase, source, s.id);
		await refresh();
	}
	async function doDeleteFolder() {
		const path = deleteFolderTarget;
		deleteFolderTarget = null;
		if (!path) return;
		await deleteFolder(supabase, source, path);
		await refresh();
	}
	async function duplicate(s: SceneDoc) {
		const copy = JSON.parse(JSON.stringify(s)) as SceneDoc;
		const id = `user-${Date.now().toString(36)}`;
		copy.id = id;
		copy.slug = id;
		copy.name = `${s.name} (copy)`;
		await persistScene(supabase, source, copy);
		await refresh();
	}
	function openInStudio(id: string) {
		goto(`/dashboard/daedalus?scene=${encodeURIComponent(id)}`);
	}

	// move-dialog destination options (exclude the scene's current folder)
	let moveOptions = $derived(['', ...allFolders]);
	let moveSceneFolder = $derived(
		moveTarget ? (scenes.find((s) => s.id === moveTarget)?.folder ?? '') : ''
	);

	// PxP MVP port: the 9realms right-click context menu (OdinContextMenu) was
	// stripped on copy-in. Card actions (rename/delete folder; move/duplicate/delete
	// scene) are surfaced instead as hover action buttons on each card — the same
	// pattern the Studio rail uses. Click still opens; drag still moves.

	// Drag a scene onto a folder tile (or breadcrumb) to move it there.
	let dragId = $state<string | null>(null);
	let dragOverFolder = $state<string | null>(null);
	function onDragStart(e: DragEvent, id: string) {
		dragId = id;
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function onDragEnd() {
		dragId = null;
		dragOverFolder = null;
	}
	function allowDrop(e: DragEvent, folder: string) {
		if (dragId === null) return;
		e.preventDefault();
		dragOverFolder = folder;
	}
	async function dropOn(e: DragEvent, folder: string) {
		e.preventDefault();
		const id = dragId ?? e.dataTransfer?.getData('text/plain') ?? '';
		dragOverFolder = null;
		dragId = null;
		if (!id) return;
		const sc = scenes.find((x) => x.id === id);
		if (!sc || (sc.folder ?? '') === folder) return;
		await moveScene(supabase, source, id, folder);
		await refresh();
	}
</script>

<div class="lib">
	<header class="lib-head">
		<nav class="crumbs">
			<button
				class="crumb"
				class:active={!cwd}
				class:drop={dragOverFolder === ''}
				onclick={() => (cwd = '')}
				ondragover={(e) => allowDrop(e, '')}
				ondragleave={() => dragOverFolder === '' && (dragOverFolder = null)}
				ondrop={(e) => dropOn(e, '')}
			>
				<Home size={14} strokeWidth={1.75} /> Library
			</button>
			{#each breadcrumbs as b (b.path)}
				<ChevronRight size={13} class="sep" />
				<button
					class="crumb"
					class:active={b.path === cwd}
					class:drop={dragOverFolder === b.path}
					onclick={() => (cwd = b.path)}
					ondragover={(e) => allowDrop(e, b.path)}
					ondragleave={() => dragOverFolder === b.path && (dragOverFolder = null)}
					ondrop={(e) => dropOn(e, b.path)}
				>{b.label}</button>
			{/each}
		</nav>
		<div class="head-actions">
			<span class="src" title={source === 'db' ? 'Shared across the team' : 'Local to this browser until the DB migration is applied'}>
				{#if source === 'db'}<Database size={12} /> Shared{:else}<HardDrive size={12} /> Local{/if}
			</span>
			<button class="btn" onclick={() => ((newFolderName = ''), (newFolderOpen = true))}>
				<FolderPlus size={14} strokeWidth={2} /> New Folder
			</button>
		</div>
	</header>

	<div class="grid">
		{#each subfolders as f (f)}
			<div class="card-wrap">
				<button
					class="card folder"
					class:drop={dragOverFolder === f}
					onclick={() => (cwd = f)}
					ondragover={(e) => allowDrop(e, f)}
					ondragleave={() => dragOverFolder === f && (dragOverFolder = null)}
					ondrop={(e) => dropOn(e, f)}
					aria-label="Open folder {lastSegment(f)}"
				>
					<Folder size={30} strokeWidth={1.4} />
					<span class="card-name">{lastSegment(f)}</span>
					<span class="card-meta">{countIn(f)} scene{countIn(f) === 1 ? '' : 's'}</span>
				</button>
				<div class="card-acts">
					<button class="act" title="Rename" aria-label="Rename folder" onclick={() => startRename(f)}>
						<Pencil size={13} strokeWidth={2} />
					</button>
					<button
						class="act danger"
						title="Delete"
						aria-label="Delete folder"
						onclick={() => (deleteFolderTarget = f)}
					>
						<Trash2 size={13} strokeWidth={2} />
					</button>
				</div>
			</div>
		{/each}

		{#each scenesHere as s (s.id)}
			<div class="card-wrap">
				<div
					class="card scene"
					class:dragging={dragId === s.id}
					role="button"
					tabindex="0"
					draggable="true"
					onclick={() => openInStudio(s.id)}
					onkeydown={(e) => (e.key === 'Enter' ? openInStudio(s.id) : null)}
					ondragstart={(e) => onDragStart(e, s.id)}
					ondragend={onDragEnd}
				>
					<Shapes size={26} strokeWidth={1.4} />
					<span class="card-name">{s.name}</span>
					<span class="card-meta">{s.primitive}</span>
				</div>
				<div class="card-acts">
					<button
						class="act"
						title="Move to folder"
						aria-label="Move scene"
						onclick={() => (moveTarget = s.id)}
					>
						<FolderInput size={13} strokeWidth={2} />
					</button>
					<button class="act" title="Duplicate" aria-label="Duplicate scene" onclick={() => duplicate(s)}>
						<Copy size={13} strokeWidth={2} />
					</button>
					<button
						class="act danger"
						title="Delete"
						aria-label="Delete scene"
						onclick={() => (deleteScene = s)}
					>
						<Trash2 size={13} strokeWidth={2} />
					</button>
				</div>
			</div>
		{/each}

		{#if subfolders.length === 0 && scenesHere.length === 0}
			<p class="empty">This folder is empty. Create scenes in the Studio, or add a subfolder. Hover an item for actions; drag a scene onto a folder to move it.</p>
		{/if}
	</div>
</div>

<!-- New folder -->
<Dialog.Root bind:open={newFolderOpen}>
	<Dialog.Content class="max-h-[90vh] w-full max-w-sm overflow-y-auto" style="background: #0f172a; border-color: #1e293b; color: #e5e7eb;">
		<Dialog.Header>
			<Dialog.Title class="text-slate-100">New folder</Dialog.Title>
			<Dialog.Description class="text-slate-400">Created inside {cwd || 'Library root'}.</Dialog.Description>
		</Dialog.Header>
		<input class="dlg-input" bind:value={newFolderName} placeholder="Folder name" onkeydown={(e) => e.key === 'Enter' && doNewFolder()} />
		<Dialog.Footer>
			<button class="dlg-btn" onclick={() => (newFolderOpen = false)}>Cancel</button>
			<button class="dlg-btn primary" onclick={doNewFolder}>Create</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Rename folder -->
<Dialog.Root open={renameTarget !== null} onOpenChange={(o) => (o ? null : (renameTarget = null))}>
	<Dialog.Content class="max-h-[90vh] w-full max-w-sm overflow-y-auto" style="background: #0f172a; border-color: #1e293b; color: #e5e7eb;">
		<Dialog.Header>
			<Dialog.Title class="text-slate-100">Rename folder</Dialog.Title>
		</Dialog.Header>
		<input class="dlg-input" bind:value={renameValue} placeholder="Folder name" onkeydown={(e) => e.key === 'Enter' && doRename()} />
		<Dialog.Footer>
			<button class="dlg-btn" onclick={() => (renameTarget = null)}>Cancel</button>
			<button class="dlg-btn primary" onclick={doRename}>Rename</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Move scene -->
<Dialog.Root open={moveTarget !== null} onOpenChange={(o) => (o ? null : (moveTarget = null))}>
	<Dialog.Content class="max-h-[90vh] w-full max-w-sm overflow-y-auto" style="background: #0f172a; border-color: #1e293b; color: #e5e7eb;">
		<Dialog.Header>
			<Dialog.Title class="text-slate-100">Move to folder</Dialog.Title>
		</Dialog.Header>
		<div class="move-list">
			{#each moveOptions as opt (opt)}
				<button class="move-row" class:current={opt === moveSceneFolder} disabled={opt === moveSceneFolder} onclick={() => doMove(opt)}>
					<Folder size={14} /> {opt || 'Library root'}
				</button>
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete scene -->
<Dialog.Root open={deleteScene !== null} onOpenChange={(o) => (o ? null : (deleteScene = null))}>
	<Dialog.Content class="max-h-[90vh] w-full max-w-sm overflow-y-auto" style="background: #0f172a; border-color: #1e293b; color: #e5e7eb;">
		<Dialog.Header>
			<Dialog.Title class="text-slate-100">Delete scene?</Dialog.Title>
			<Dialog.Description class="text-slate-400">"{deleteScene?.name}" will be permanently removed.</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<button class="dlg-btn" onclick={() => (deleteScene = null)}>Cancel</button>
			<button class="dlg-btn danger" onclick={doDeleteScene}>Delete</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete folder -->
<Dialog.Root open={deleteFolderTarget !== null} onOpenChange={(o) => (o ? null : (deleteFolderTarget = null))}>
	<Dialog.Content class="max-h-[90vh] w-full max-w-sm overflow-y-auto" style="background: #0f172a; border-color: #1e293b; color: #e5e7eb;">
		<Dialog.Header>
			<Dialog.Title class="text-slate-100">Delete folder?</Dialog.Title>
			<Dialog.Description class="text-slate-400">
				{#if deleteFolderTarget && countIn(deleteFolderTarget) > 0}
					"{lastSegment(deleteFolderTarget)}" still contains {countIn(deleteFolderTarget)} scene(s). Move or delete them first.
				{:else}
					Remove the empty folder "{deleteFolderTarget ? lastSegment(deleteFolderTarget) : ''}".
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<button class="dlg-btn" onclick={() => (deleteFolderTarget = null)}>Cancel</button>
			<button
				class="dlg-btn danger"
				disabled={!!deleteFolderTarget && countIn(deleteFolderTarget) > 0}
				onclick={doDeleteFolder}>Delete</button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.lib {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 1.25rem;
	}
	.lib-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.crumbs {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.crumb {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.4rem;
		font-size: 0.82rem;
		color: #94a3b8; /* slate-400 */
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.crumb.active {
		color: #f8fafc; /* slate-50 */
		font-weight: 600;
	}
	.crumb:hover {
		color: #fff;
	}
	.crumb.drop {
		color: #fff;
		background: rgba(0, 165, 207, 0.15); /* accent-primary tint */
		outline: 1px dashed var(--accent-primary, #00a5cf);
	}
	.crumbs :global(.sep) {
		color: #475569; /* slate-600 */
	}
	.head-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.src {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8; /* slate-400 */
		border: 1px solid #1e293b; /* slate-800 */
		padding: 0.2rem 0.45rem;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.7rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--accent-primary, #00a5cf);
		background: #1e293b; /* slate-800 */
		border: 1px solid #334155; /* slate-700 */
		cursor: pointer;
		transition: border-color 0.12s ease;
	}
	.btn:hover {
		border-color: var(--accent-primary, #00a5cf);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.75rem;
	}
	@media (min-width: 480px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		}
	}
	/* PxP MVP: hover action buttons replace the 9realms right-click card menu. */
	.card-wrap {
		position: relative;
	}
	.card-acts {
		position: absolute;
		top: 0.3rem;
		right: 0.3rem;
		display: inline-flex;
		gap: 0.1rem;
		opacity: 0;
		transition: opacity 0.12s ease;
	}
	.card-wrap:hover .card-acts,
	.card-wrap:focus-within .card-acts {
		opacity: 1;
	}
	.act {
		display: grid;
		place-items: center;
		padding: 0.3rem;
		color: #94a3b8; /* slate-400 */
		background: #0f172a; /* slate-900 */
		border: 1px solid #334155; /* slate-700 */
		cursor: pointer;
		transition: color 0.12s ease, border-color 0.12s ease;
	}
	.act:hover {
		color: var(--accent-primary, #00a5cf);
		border-color: var(--accent-primary, #00a5cf);
	}
	.act.danger:hover {
		color: #f87171;
		border-color: #f87171;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		width: 100%;
		padding: 1.1rem 0.6rem 1rem;
		color: #e2e8f0; /* slate-200 */
		text-align: center;
		border: 1px solid #1e293b; /* slate-800 */
		background: #0f172a; /* slate-900 */
		cursor: pointer;
		transition: border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
	}
	.card:hover {
		border-color: var(--accent-primary, #00a5cf);
		background: #1e293b; /* slate-800 */
	}
	.card.folder :global(svg) {
		color: var(--accent-primary, #00a5cf);
	}
	.card.scene :global(svg) {
		color: #94a3b8; /* slate-400 */
	}
	.card.folder.drop {
		border-color: var(--accent-primary, #00a5cf);
		background: rgba(0, 165, 207, 0.12); /* accent-primary tint */
		box-shadow: 0 0 0 1px var(--accent-primary, #00a5cf);
	}
	.card.scene.dragging {
		opacity: 0.4;
	}
	.card-name {
		font-size: 0.8rem;
		font-weight: 600;
		text-align: center;
		line-height: 1.2;
		word-break: break-word;
	}
	.card-meta {
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #64748b; /* slate-500 */
	}
	.empty {
		grid-column: 1 / -1;
		padding: 2rem;
		text-align: center;
		font-size: 0.82rem;
		color: #64748b; /* slate-500 */
	}
	.dlg-input {
		width: 100%;
		background: #020617; /* slate-950 */
		border: 1px solid #334155; /* slate-700 */
		color: #f1f5f9;
		padding: 0.5rem 0.55rem;
		font-size: 0.85rem;
	}
	.dlg-input:focus {
		outline: none;
		border-color: var(--accent-primary, #00a5cf);
	}
	.move-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 16rem;
		overflow-y: auto;
	}
	.move-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.55rem;
		text-align: left;
		font-size: 0.82rem;
		color: #e2e8f0; /* slate-200 */
		background: #020617; /* slate-950 */
		border: 1px solid #334155; /* slate-700 */
		cursor: pointer;
	}
	.move-row:hover:not(:disabled) {
		border-color: var(--accent-primary, #00a5cf);
	}
	.move-row.current {
		opacity: 0.45;
		cursor: default;
	}
	.move-row :global(svg) {
		color: var(--accent-primary, #00a5cf);
		flex: none;
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
	.dlg-btn.primary {
		color: var(--accent-primary, #00a5cf);
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
	.dlg-btn.danger:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>

<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/shadcn/ui/dialog';
	import {
		Grid3X3,
		Grid2X2,
		List,
		Upload,
		RefreshCw,
		Image as ImgIcon,
		Video,
		Copy,
		Trash2,
		Check
	} from 'lucide-svelte';
	import DiamondSpinner from '$lib/components/custom/loader/DiamondSpinner.svelte';

	interface MediaRow {
		id: string;
		bucket: string;
		path: string;
		url: string;
		type: 'image' | 'video' | 'other';
		size: number;
		content_type: string | null;
		uploaded_by: string | null;
		metadata: Record<string, unknown> | null;
		created_at: string;
		updated_at: string;
	}

	interface MediaItem {
		name: string;
		id: string;
		publicUrl: string;
		size: number;
		updated_at: string;
		contentType: string | null;
		type: 'image' | 'video' | 'other';
	}

	let { supabase } = $props<{ supabase: SupabaseClient }>();

	// state
	let currentView = $state<'grid-small' | 'grid-medium' | 'list'>('grid-medium');
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let search = $state('');
	let folder = $state<string>('');
	let items = $state<MediaItem[]>([]);
	let selected = new SvelteSet<string>();
	let isUploadOpen = $state(false);
	let filesToUpload = $state<FileList | null>(null);
	let copiedId = $state<string | null>(null);

	let gridClasses = $derived(
		currentView === 'grid-small'
			? 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
			: currentView === 'grid-medium'
				? 'grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
				: 'flex flex-col gap-3'
	);

	$effect(() => {
		loadMedia();
	});

	async function loadMedia() {
		isLoading = true;
		error = null;
		try {
			const likeFolder = folder ? `%${folder.replaceAll('%', '\\%')}%` : '%';
			const likeSearch = search ? `%${search.replaceAll('%', '\\%')}%` : '%';

			let query = supabase
				.from('media_assets')
				.select('*')
				.ilike('path', likeFolder)
				.ilike('path', likeSearch)
				.order('updated_at', { ascending: false })
				.limit(1000);

			const { data, error: qErr } = await query;
			if (qErr) throw qErr;

			items = (data as MediaRow[]).map((r) => ({
				name: r.path.split('/').pop() || r.path,
				id: r.path,
				publicUrl: r.url,
				size: r.size,
				updated_at: r.updated_at,
				contentType: r.content_type,
				type: r.type
			}));
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to load media';
		} finally {
			isLoading = false;
		}
	}

	function toggleSelect(id: string) {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}

	function copy(url: string, id: string) {
		navigator.clipboard.writeText(url);
		copiedId = id;
		setTimeout(() => {
			copiedId = null;
		}, 2000);
	}

	async function remove(id: string) {
		if (!confirm('Delete this file?')) return;

		// remove from Storage first
		const { error: delErr } = await supabase.storage.from('media_library').remove([id]);
		if (delErr) {
			error = delErr.message;
			return;
		}

		// then delete DB row
		const { error: dbErr } = await supabase
			.from('media_assets')
			.delete()
			.eq('path', id);

		if (dbErr) {
			error = dbErr.message;
		}

		await loadMedia();
	}

	function detectType(ext: string): MediaItem['type'] {
		const e = ext.toLowerCase();
		if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg'].includes(e)) return 'image';
		if (['mp4', 'mov', 'webm', 'm4v', 'mkv'].includes(e)) return 'video';
		return 'other';
	}

	async function upload() {
		if (!filesToUpload || filesToUpload.length === 0) return;

		// fetch user for uploaded_by
		const { data: u } = await supabase.auth.getUser();
		const uid = u?.user?.id ?? null;

		for (const file of Array.from(filesToUpload)) {
			const key = (folder ? folder.replace(/^\/|\/$/g, '') + '/' : '') + file.name;
			// 1) upload or upsert
			const up = await supabase.storage.from('media_library').upload(key, file, { upsert: true });
			if (up.error) {
				error = up.error.message;
				continue;
			}
			// 2) public URL
			const { data: pub } = supabase.storage.from('media_library').getPublicUrl(key);
			// 3) infer type
			const ext = file.name.split('.').pop() || '';
			const kind = detectType(ext);
			// 4) upsert DB row
			const { error: insErr } = await supabase
				.from('media_assets')
				.upsert(
					{
						bucket: 'media_library',
						path: key,
						url: pub.publicUrl,
						type: kind,
						size: file.size,
						content_type: file.type || null,
						uploaded_by: uid,
						metadata: {}
					},
					{ onConflict: 'path' }
				);

			if (insErr) {
				error = insErr.message;
			}
		}

		isUploadOpen = false;
		filesToUpload = null;
		await loadMedia();
	}
</script>

<div class="mx-auto max-w-6xl">
	<header class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-center gap-3">
			<ImgIcon class="h-6 w-6 text-accent-primary" />
			<div>
				<h1 class="text-2xl font-bold text-white">Media Library</h1>
				<p class="mt-0.5 text-sm text-slate-400">Upload and manage shared media assets.</p>
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<div class="flex gap-1 border-r border-slate-700 pr-2">
				<button
					type="button"
					aria-label="Small grid"
					onclick={() => (currentView = 'grid-small')}
					class="inline-flex h-9 w-9 items-center justify-center border transition {currentView ===
					'grid-small'
						? 'border-accent-primary bg-accent-primary text-slate-950'
						: 'border-slate-700 bg-slate-800 text-slate-300 hover:text-accent-primary'}"
				>
					<Grid3X3 class="h-4 w-4" />
				</button>
				<button
					type="button"
					aria-label="Medium grid"
					onclick={() => (currentView = 'grid-medium')}
					class="inline-flex h-9 w-9 items-center justify-center border transition {currentView ===
					'grid-medium'
						? 'border-accent-primary bg-accent-primary text-slate-950'
						: 'border-slate-700 bg-slate-800 text-slate-300 hover:text-accent-primary'}"
				>
					<Grid2X2 class="h-4 w-4" />
				</button>
				<button
					type="button"
					aria-label="List view"
					onclick={() => (currentView = 'list')}
					class="inline-flex h-9 w-9 items-center justify-center border transition {currentView ===
					'list'
						? 'border-accent-primary bg-accent-primary text-slate-950'
						: 'border-slate-700 bg-slate-800 text-slate-300 hover:text-accent-primary'}"
				>
					<List class="h-4 w-4" />
				</button>
			</div>

			<button
				type="button"
				onclick={loadMedia}
				aria-label="Refresh"
				class="inline-flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary"
			>
				<RefreshCw class="h-4 w-4" />
			</button>

			<button
				type="button"
				onclick={() => (isUploadOpen = true)}
				class="inline-flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90"
			>
				<Upload class="h-4 w-4" />
				Upload
			</button>
		</div>
	</header>

	<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
		<div class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
			<label for="media-folder" class="text-xs font-medium uppercase tracking-wider text-slate-400"
				>Folder</label
			>
			<input
				id="media-folder"
				class="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none sm:w-56"
				placeholder="e.g. products"
				bind:value={folder}
				onchange={loadMedia}
			/>
		</div>
		<div class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
			<label for="media-search" class="text-xs font-medium uppercase tracking-wider text-slate-400"
				>Search</label
			>
			<input
				id="media-search"
				class="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none sm:w-72"
				placeholder="filename…"
				bind:value={search}
				oninput={loadMedia}
			/>
		</div>
		{#if selected.size}
			<div class="shrink-0 text-xs text-slate-300">{selected.size} selected</div>
		{/if}
	</div>

	{#if isLoading}
		<div class="flex h-[40vh] items-center justify-center">
			<DiamondSpinner size="lg" text="Loading media..." />
		</div>
	{:else if error}
		<div class="my-4 border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
	{:else if items.length === 0}
		<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500">
			No media found.
		</div>
	{:else}
		<div class={gridClasses}>
			{#each items as it (it.id)}
				{#if currentView === 'list'}
					<div
						class="flex flex-col gap-3 border border-slate-800 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="flex min-w-0 items-center gap-3">
							<div class="h-12 w-16 shrink-0 overflow-hidden border border-slate-700 bg-slate-800">
								{#if it.type === 'image'}
									<img
										src={it.publicUrl}
										alt={it.name}
										class="h-full w-full object-cover"
										loading="lazy"
									/>
								{:else if it.type === 'video'}
									<Video class="m-2 h-8 w-8 text-slate-400" />
								{:else}
									<ImgIcon class="m-2 h-8 w-8 text-slate-400" />
								{/if}
							</div>
							<div class="min-w-0">
								<p class="truncate text-sm text-slate-200">{it.name}</p>
								<p class="text-xs text-slate-500">
									{it.updated_at?.slice(0, 10)} · {(it.size / 1024).toFixed(1)} KB
								</p>
							</div>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<button
								type="button"
								onclick={() => copy(it.publicUrl, it.id)}
								class="inline-flex items-center gap-1.5 border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 transition hover:text-accent-primary"
							>
								{#if copiedId === it.id}
									<Check class="h-3.5 w-3.5 text-emerald-400" /> Copied
								{:else}
									<Copy class="h-3.5 w-3.5" /> Copy URL
								{/if}
							</button>
							<button
								type="button"
								aria-label="Delete"
								class="inline-flex items-center gap-1.5 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/20"
								onclick={() => remove(it.id)}
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				{:else}
					<button
						type="button"
						class="group relative overflow-hidden border border-slate-800 bg-slate-900/50 p-2 text-left transition hover:border-accent-primary"
						onclick={() => toggleSelect(it.id)}
					>
						<div class="relative aspect-square w-full overflow-hidden border border-slate-800 bg-slate-800">
							{#if it.type === 'image'}
								<img
									src={it.publicUrl}
									alt={it.name}
									class="h-full w-full object-cover"
									loading="lazy"
								/>
							{:else if it.type === 'video'}
								<video src={it.publicUrl} class="h-full w-full object-cover" muted></video>
							{:else}
								<div class="flex h-full items-center justify-center">
									<ImgIcon class="h-10 w-10 text-slate-400" />
								</div>
							{/if}
							{#if selected.has(it.id)}
								<div class="absolute inset-0 flex items-center justify-center bg-accent-primary/40">
									<Check class="h-7 w-7 text-white" />
								</div>
							{/if}
						</div>
						<div class="mt-2 flex items-center justify-between gap-2">
							<p class="min-w-0 truncate text-sm text-slate-200" title={it.name}>{it.name}</p>
							<div class="flex shrink-0 gap-1">
								<span
									role="button"
									tabindex="0"
									aria-label="Copy URL"
									class="inline-flex h-8 w-8 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary"
									onclick={(e: MouseEvent) => {
										e.stopPropagation();
										copy(it.publicUrl, it.id);
									}}
									onkeydown={(e: KeyboardEvent) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
											copy(it.publicUrl, it.id);
										}
									}}
								>
									{#if copiedId === it.id}
										<Check class="h-4 w-4 text-emerald-400" />
									{:else}
										<Copy class="h-4 w-4" />
									{/if}
								</span>
								<span
									role="button"
									tabindex="0"
									aria-label="Delete"
									class="inline-flex h-8 w-8 items-center justify-center border border-red-500/40 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
									onclick={(e: MouseEvent) => {
										e.stopPropagation();
										remove(it.id);
									}}
									onkeydown={(e: KeyboardEvent) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
											remove(it.id);
										}
									}}
								>
									<Trash2 class="h-4 w-4" />
								</span>
							</div>
						</div>
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<!-- Upload dialog -->
<Dialog bind:open={isUploadOpen}>
	<DialogContent
		class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-none border border-slate-700 bg-slate-900 p-4 text-slate-100"
	>
		<DialogHeader>
			<DialogTitle class="text-lg font-bold text-white">Upload Media</DialogTitle>
			<DialogDescription class="text-sm text-slate-400">
				Files go to bucket "media_library"{folder ? ` / ${folder}` : ''}.
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-3 py-2">
			<div class="flex flex-col gap-1.5">
				<label for="upload-folder" class="text-sm text-slate-300">Target folder</label>
				<input
					id="upload-folder"
					class="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
					bind:value={folder}
					placeholder="optional subfolder"
				/>
			</div>
			<div>
				<input
					type="file"
					accept="image/*,video/*"
					multiple
					onchange={(e: Event) => (filesToUpload = (e.target as HTMLInputElement).files)}
					class="w-full border border-slate-700 bg-slate-900 p-2 text-sm text-slate-300 file:mr-3 file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-sm file:text-slate-300"
				/>
			</div>
		</div>

		<DialogFooter class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
			<button
				type="button"
				onclick={() => (isUploadOpen = false)}
				class="inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={upload}
				disabled={!filesToUpload || filesToUpload.length === 0}
				class="inline-flex items-center justify-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:opacity-60"
			>
				<Upload class="h-4 w-4" /> Upload
			</button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { Button } from '$lib/components/shadcn/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/shadcn/ui/dialog';
	import { Input } from '$lib/components/shadcn/ui/input';
	import { Label } from '$lib/components/shadcn/ui/label';
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
	import type { MediaRow, MediaItem } from '@parallaxrealms/types-auth';
	import DiamondSpinner from '$lib/components/custom/loader/DiamondSpinner.svelte';

	let { supabase } = $props<{ supabase: SupabaseClient }>();

	// state
	let currentView = $state<'grid-small' | 'grid-medium' | 'list'>('grid-medium');
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let search = $state('');
	let folder = $state<string>(''); // optional subfolder filter
	let items = $state<MediaItem[]>([]);
	let selected = $state<Set<string>>(new Set());
	let isUploadOpen = $state(false);
	let filesToUpload = $state<FileList | null>(null);

	let gridClasses = $derived(
		currentView === 'grid-small'
			? 'grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
			: currentView === 'grid-medium'
				? 'grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
				: 'flex flex-col gap-4'
	);

	$effect(() => {
		loadMedia();
	});

	async function loadMedia() {
		isLoading = true;
		error = null;
		try {
			// filter by folder and search using ilike on path
			const likeFolder = folder ? `%${folder.replaceAll('%', '\\%')}%` : '%';
			const likeSearch = search ? `%${search.replaceAll('%', '\\%')}%` : '%';

			let query = supabase
				.schema('odin')
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
		} catch (e: any) {
			error = e.message ?? 'Failed to load media';
		} finally {
			isLoading = false;
		}
	}

	function toggleSelect(id: string) {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
		selected = new Set(selected);
	}

	function copy(url: string) {
		navigator.clipboard.writeText(url);
	}

	async function remove(id: string) {
		if (!confirm('Delete this file?')) return;

		// remove from Storage first
		const { error: delErr } = await supabase.storage.from('odin').remove([id]);
		if (delErr) {
			error = delErr.message;
			return;
		}

		// then delete DB row
		const { error: dbErr } = await supabase
			.schema('odin')
			.from('media_assets')
			.delete()
			.eq('path', id);

		if (dbErr) {
			error = dbErr.message;
			// do not early return; UI will refetch
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
			const up = await supabase.storage.from('odin').upload(key, file, { upsert: true });
			if (up.error) {
				error = up.error.message;
				continue;
			}
			// 2) public URL
			const { data: pub } = supabase.storage.from('odin').getPublicUrl(key);
			// 3) infer type
			const ext = file.name.split('.').pop() || '';
			const kind = detectType(ext);
			// 4) upsert DB row
			const { error: insErr } = await supabase
				.schema('odin')
				.from('media_assets')
				.upsert(
					{
						bucket: 'odin',
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

<div class="tab-header">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-slate-100">Media Library</h1>
		<div class="flex items-center gap-2">
			<div class="flex gap-1 border-r border-slate-500 pr-3">
				<Button
					size="sm"
					variant="outline"
					onclick={() => (currentView = 'grid-small')}
					class={currentView === 'grid-small' ? 'bg-blue-600 text-white' : ''}
				>
					<Grid3X3 class="h-4 w-4" />
				</Button>
				<Button
					size="sm"
					variant="outline"
					onclick={() => (currentView = 'grid-medium')}
					class={currentView === 'grid-medium' ? 'bg-blue-600 text-white' : ''}
				>
					<Grid2X2 class="h-4 w-4" />
				</Button>
				<Button
					size="sm"
					variant="outline"
					onclick={() => (currentView = 'list')}
					class={currentView === 'list' ? 'bg-blue-600 text-white' : ''}
				>
					<List class="h-4 w-4" />
				</Button>
			</div>

			<Button size="sm" variant="outline" onclick={loadMedia} aria-label="Refresh">
				<RefreshCw class="h-4 w-4" />
			</Button>

			<Button onclick={() => (isUploadOpen = true)}>
				<Upload class="mr-2 h-4 w-4" />
				Upload Media
			</Button>
		</div>
	</div>
</div>

<div class="mb-4 flex flex-wrap items-center gap-3 text-slate-100">
	<div class="flex items-center gap-2">
		<Label class="text-sm">Folder</Label>
		<Input
			class="form-control h-8 w-56"
			placeholder="e.g. products"
			bind:value={folder}
			onchange={loadMedia}
		/>
	</div>
	<div class="flex items-center gap-2">
		<Label class="text-sm">Search</Label>
		<Input
			class="form-control h-8 w-72"
			placeholder="filename…"
			bind:value={search}
			oninput={loadMedia}
		/>
	</div>
	{#if selected.size}
		<div class="text-xs text-slate-300">{selected.size} selected</div>
	{/if}
</div>

{#if isLoading}
	<div class="flex h-[40vh] items-center justify-center">
		<DiamondSpinner size="lg" text="Loading media..." />
	</div>
{:else if error}
	<div class="my-4 rounded-md bg-red-900/30 p-4 text-red-200">{error}</div>
{:else if items.length === 0}
	<p class="mt-8 text-center text-slate-400">No media found.</p>
{:else}
	<div class={gridClasses}>
		{#each items as it}
			{#if currentView === 'list'}
				<div
					class="flex items-center justify-between border border-slate-700/50 bg-slate-900/80 p-3"
				>
					<div class="flex items-center gap-3">
						<div class="h-12 w-16 overflow-hidden bg-slate-700/70">
							{#if it.type === 'image'}
								<img
									src={it.publicUrl}
									alt={it.name}
									class="h-full w-full object-cover"
									loading="lazy"
								/>
							{:else if it.type === 'video'}
								<Video class="m-2 h-8 w-8 text-slate-300" />
							{:else}
								<ImgIcon class="m-2 h-8 w-8 text-slate-300" />
							{/if}
						</div>
						<div class="min-w-0">
							<p class="truncate text-slate-100">{it.name}</p>
							<p class="text-xs text-slate-400">
								{it.updated_at?.slice(0, 10)} · {(it.size / 1024).toFixed(1)} KB
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" onclick={() => copy(it.publicUrl)}>
							<Copy class="mr-1 h-3 w-3" /> Copy URL
						</Button>
						<Button
							variant="ghost"
							size="sm"
							class="text-red-400 hover:bg-red-500/10"
							onclick={() => remove(it.id)}
						>
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
				</div>
			{:else}
				<button
					type="button"
					class="group relative overflow-hidden border border-slate-700/50 bg-slate-900/80 p-2 text-left transition hover:border-slate-500"
					onclick={() => toggleSelect(it.id)}
				>
					<div class="relative h-36 w-full bg-slate-700/70">
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
								<ImgIcon class="h-10 w-10 text-slate-300" />
							</div>
						{/if}
						{#if selected.has(it.id)}
							<div class="absolute inset-0 flex items-center justify-center bg-blue-600/40">
								<Check class="h-7 w-7 text-white" />
							</div>
						{/if}
					</div>
					<div class="mt-2 flex items-center justify-between">
						<p class="truncate text-sm text-slate-100" title={it.name}>{it.name}</p>
						<div class="flex gap-1">
							<Button
								variant="outline"
								size="icon"
								class="h-8 w-8"
								onclick={(e: any) => {
									e.stopPropagation();
									copy(it.publicUrl);
								}}
							>
								<Copy class="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 text-red-400 hover:bg-red-500/10"
								onclick={(e: any) => {
									e.stopPropagation();
									remove(it.id);
								}}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</div>
					</div>
				</button>
			{/if}
		{/each}
	</div>
{/if}

<!-- Upload dialog -->
<Dialog bind:open={isUploadOpen}>
	<DialogContent
		class="max-w-lg border border-slate-700 bg-slate-800 p-4 text-slate-100"
	>
		<DialogHeader>
			<DialogTitle>Upload media</DialogTitle>
			<DialogDescription
				>Files go to bucket “odin”{folder ? ` / ${folder}` : ''} and into odin.media_assets.</DialogDescription
			>
		</DialogHeader>

		<div class="space-y-3">
			<div>
				<Label>Target folder</Label>
				<Input class="form-control" bind:value={folder} placeholder="optional subfolder" />
			</div>
			<div>
				<input
					type="file"
					accept="image/*,video/*"
					multiple
					onchange={(e: Event) => (filesToUpload = (e.target as HTMLInputElement).files)}
					class="w-full border border-slate-600 bg-slate-700 p-2"
				/>
			</div>
		</div>

		<DialogFooter class="mt-4">
			<Button variant="outline" onclick={() => (isUploadOpen = false)}>Cancel</Button>
			<Button onclick={upload} disabled={!filesToUpload || filesToUpload.length === 0}>
				<Upload class="mr-2 h-4 w-4" /> Upload
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<style lang="postcss">
	.tab-header {
		@apply my-8 border border-slate-700/50 bg-gradient-to-r from-slate-900/90 to-slate-800/90 p-6 shadow-xl backdrop-blur-sm;
	}
</style>

<script lang="ts">
	/**
	 * Mockup Library — saved mockup projects grid/list, ported from 9realms VULCAN
	 * and reworked for Parallax & Pixel.
	 *
	 * REWORK vs 9realms:
	 *  - Reads public.mockup_projects via the session supabase client (no `.schema('nine')`).
	 *  - No catalog/variant columns (variant_name/variant_color dropped).
	 *  - Odin kit (OdinContextMenu/OdinViewToggle/OdinDraggableList/OdinDialog) replaced
	 *    with native inline action buttons, a native grid/list toggle, and native modals.
	 *  - No drag-reorder (no dnd dep): ordered by created_at desc.
	 *  - Sharp/native styling per ref/UI-STYLE.md (no rounded corners, slate + accent).
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { MockupProject } from '$lib/types/mockups';
	import {
		ExternalLink,
		Trash2,
		Pencil,
		Download,
		Search,
		Calendar,
		Shirt,
		LayoutGrid,
		List,
		Plus,
		Loader2,
		X
	} from 'lucide-svelte';

	interface Props {
		supabase: SupabaseClient;
		oneditMockup: (mockup: MockupProject) => void;
		onnew: () => void;
	}

	let { supabase, oneditMockup, onnew }: Props = $props();

	type ViewMode = 'grid' | 'list';
	let viewMode = $state<ViewMode>('grid');

	let mockups = $state<MockupProject[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');

	// View dialog
	let viewDialogOpen = $state(false);
	let selectedMockup = $state<MockupProject | null>(null);
	let currentViewIndex = $state(0);

	// Delete dialog
	let deleteDialogOpen = $state(false);
	let mockupToDelete = $state<MockupProject | null>(null);
	let isDeleting = $state(false);

	let filteredMockups = $derived(
		searchQuery
			? mockups.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: mockups
	);

	async function loadMockups() {
		isLoading = true;
		error = null;
		try {
			const { data, error: fetchError } = await supabase
				.from('mockup_projects')
				.select('*')
				.order('created_at', { ascending: false });

			if (fetchError) throw fetchError;
			mockups = (data || []) as MockupProject[];
		} catch (err) {
			console.error('Error loading mockups:', err);
			error = err instanceof Error ? err.message : 'Failed to load mockups';
		} finally {
			isLoading = false;
		}
	}

	function getThumbnail(mockup: MockupProject): string {
		return (
			mockup.thumbnail_url ||
			mockup.front_image_url ||
			mockup.back_image_url ||
			mockup.side_image_url ||
			''
		);
	}

	function getAvailableViews(mockup: MockupProject): { label: string; url: string }[] {
		const views: { label: string; url: string }[] = [];
		if (mockup.front_image_url) views.push({ label: 'Front', url: mockup.front_image_url });
		if (mockup.back_image_url) views.push({ label: 'Back', url: mockup.back_image_url });
		if (mockup.side_image_url) views.push({ label: 'Side', url: mockup.side_image_url });
		if (mockup.strip_image_url) views.push({ label: 'Strip', url: mockup.strip_image_url });
		return views;
	}

	function openViewDialog(mockup: MockupProject) {
		selectedMockup = mockup;
		currentViewIndex = 0;
		viewDialogOpen = true;
	}

	function confirmDelete(mockup: MockupProject) {
		mockupToDelete = mockup;
		deleteDialogOpen = true;
	}

	async function deleteMockup() {
		if (!mockupToDelete) return;
		isDeleting = true;
		try {
			const { error: deleteError } = await supabase
				.from('mockup_projects')
				.delete()
				.eq('id', mockupToDelete.id);
			if (deleteError) throw deleteError;

			mockups = mockups.filter((m) => m.id !== mockupToDelete!.id);
			deleteDialogOpen = false;
			mockupToDelete = null;
		} catch (err) {
			console.error('Error deleting mockup:', err);
			error = err instanceof Error ? err.message : 'Failed to delete mockup';
		} finally {
			isDeleting = false;
		}
	}

	function downloadImage(url: string, filename: string) {
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.target = '_blank';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function downloadFirst(mockup: MockupProject) {
		const views = getAvailableViews(mockup);
		if (views.length === 0) return;
		downloadImage(views[0].url, `${mockup.name || 'mockup'}-${views[0].label}.png`);
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function handleBackdrop(e: MouseEvent, close: () => void) {
		if (e.target === e.currentTarget) close();
	}

	$effect(() => {
		loadMockups();
	});
</script>

<div class="mx-auto max-w-6xl">
	<!-- Toolbar -->
	<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
		<div class="relative flex-1 sm:max-w-md">
			<Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search mockups…"
				class="w-full border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
			/>
		</div>

		<div class="flex items-center gap-3 sm:ml-auto">
			<span class="text-sm text-slate-400">
				{filteredMockups.length} mockup{filteredMockups.length !== 1 ? 's' : ''}
			</span>

			<!-- Native grid/list toggle -->
			<div class="flex border border-slate-700">
				<button
					type="button"
					class="flex h-9 w-9 items-center justify-center transition {viewMode === 'grid'
						? 'bg-accent-primary text-slate-950'
						: 'bg-slate-800 text-slate-400 hover:text-accent-primary'}"
					onclick={() => (viewMode = 'grid')}
					aria-label="Grid view"
					title="Grid view"
				>
					<LayoutGrid class="h-4 w-4" />
				</button>
				<button
					type="button"
					class="flex h-9 w-9 items-center justify-center border-l border-slate-700 transition {viewMode ===
					'list'
						? 'bg-accent-primary text-slate-950'
						: 'bg-slate-800 text-slate-400 hover:text-accent-primary'}"
					onclick={() => (viewMode = 'list')}
					aria-label="List view"
					title="List view"
				>
					<List class="h-4 w-4" />
				</button>
			</div>

			<button
				type="button"
				class="inline-flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90"
				onclick={onnew}
			>
				<Plus class="h-4 w-4" /> New mockup
			</button>
		</div>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-16">
			<Loader2 class="h-6 w-6 animate-spin text-slate-600" />
		</div>
	{:else if error}
		<div class="my-4 border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
			<p>{error}</p>
			<button
				type="button"
				class="mt-2 inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
				onclick={() => loadMockups()}
			>
				Retry
			</button>
		</div>
	{:else if filteredMockups.length === 0}
		<div
			class="flex flex-col items-center justify-center border border-slate-800 bg-slate-900/50 px-4 py-16 text-center"
		>
			{#if searchQuery}
				<p class="text-base text-slate-400">No mockups match your search.</p>
				<button
					type="button"
					class="mt-4 inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
					onclick={() => (searchQuery = '')}
				>
					Clear search
				</button>
			{:else}
				<Shirt class="mb-4 h-14 w-14 text-slate-600" />
				<p class="text-base text-slate-400">No mockups created yet.</p>
				<p class="mt-1 text-sm text-slate-500">Click "New mockup" to create your first one.</p>
			{/if}
		</div>
	{:else if viewMode === 'list'}
		<!-- List view -->
		<div class="overflow-hidden border border-slate-800">
			<div class="divide-y divide-slate-800">
				{#each filteredMockups as mockup (mockup.id)}
					<div class="group flex items-center gap-3 bg-slate-950 px-3 py-2 hover:bg-slate-900/60">
						<div class="h-10 w-12 shrink-0 overflow-hidden border border-slate-800 bg-slate-800">
							{#if getThumbnail(mockup)}
								<img
									src={getThumbnail(mockup)}
									alt={mockup.name}
									class="h-full w-full object-contain"
									loading="lazy"
								/>
							{:else}
								<div class="flex h-full items-center justify-center">
									<Shirt class="h-4 w-4 text-slate-600" />
								</div>
							{/if}
						</div>

						<div class="min-w-0 flex-1">
							<h3 class="truncate text-sm font-semibold text-slate-100">{mockup.name}</h3>
							<div class="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
								<Calendar class="h-3 w-3" />
								{formatDate(mockup.created_at)}
							</div>
						</div>

						<div class="hidden shrink-0 gap-1 sm:flex">
							{#if mockup.front_image_url}
								<span class="bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">Front</span>
							{/if}
							{#if mockup.back_image_url}
								<span class="bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">Back</span>
							{/if}
							{#if mockup.side_image_url}
								<span class="bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">Side</span>
							{/if}
						</div>

						<!-- Inline actions -->
						<div class="flex shrink-0 items-center gap-1">
							<button
								type="button"
								class="flex h-8 w-8 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary"
								onclick={() => openViewDialog(mockup)}
								title="View"
								aria-label="View"
							>
								<ExternalLink class="h-4 w-4" />
							</button>
							<button
								type="button"
								class="flex h-8 w-8 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary"
								onclick={() => oneditMockup(mockup)}
								title="Edit"
								aria-label="Edit"
							>
								<Pencil class="h-4 w-4" />
							</button>
							<button
								type="button"
								class="flex h-8 w-8 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary disabled:opacity-40"
								onclick={() => downloadFirst(mockup)}
								disabled={getAvailableViews(mockup).length === 0}
								title="Download"
								aria-label="Download"
							>
								<Download class="h-4 w-4" />
							</button>
							<button
								type="button"
								class="flex h-8 w-8 items-center justify-center border border-red-500/40 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
								onclick={() => confirmDelete(mockup)}
								title="Delete"
								aria-label="Delete"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Grid view -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
			{#each filteredMockups as mockup (mockup.id)}
				<div class="group flex flex-col overflow-hidden border border-slate-800 bg-slate-900/50 transition hover:border-accent-primary/50">
					<!-- Thumbnail -->
					<div class="aspect-square w-full overflow-hidden bg-slate-800">
						{#if getThumbnail(mockup)}
							<img
								src={getThumbnail(mockup)}
								alt={mockup.name}
								class="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
								loading="lazy"
							/>
						{:else}
							<div class="flex h-full items-center justify-center">
								<Shirt class="h-14 w-14 text-slate-600" />
							</div>
						{/if}
					</div>

					<div class="flex flex-1 flex-col p-3">
						<h3 class="line-clamp-1 text-sm font-semibold text-white">{mockup.name}</h3>
						<div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
							<Calendar class="h-3 w-3" />
							{formatDate(mockup.created_at)}
						</div>

						<div class="mt-2 flex flex-wrap gap-1">
							{#if mockup.front_image_url}
								<span class="bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">Front</span>
							{/if}
							{#if mockup.back_image_url}
								<span class="bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">Back</span>
							{/if}
							{#if mockup.side_image_url}
								<span class="bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">Side</span>
							{/if}
						</div>

						<!-- Inline actions -->
						<div class="mt-3 flex items-center gap-1 border-t border-slate-800 pt-3">
							<button
								type="button"
								class="flex h-8 flex-1 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary"
								onclick={() => openViewDialog(mockup)}
								title="View"
								aria-label="View"
							>
								<ExternalLink class="h-4 w-4" />
							</button>
							<button
								type="button"
								class="flex h-8 flex-1 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary"
								onclick={() => oneditMockup(mockup)}
								title="Edit"
								aria-label="Edit"
							>
								<Pencil class="h-4 w-4" />
							</button>
							<button
								type="button"
								class="flex h-8 flex-1 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary disabled:opacity-40"
								onclick={() => downloadFirst(mockup)}
								disabled={getAvailableViews(mockup).length === 0}
								title="Download"
								aria-label="Download"
							>
								<Download class="h-4 w-4" />
							</button>
							<button
								type="button"
								class="flex h-8 flex-1 items-center justify-center border border-red-500/40 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
								onclick={() => confirmDelete(mockup)}
								title="Delete"
								aria-label="Delete"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- View Mockup Dialog (native modal) -->
{#if viewDialogOpen && selectedMockup}
	{@const views = getAvailableViews(selectedMockup)}
	<div
		role="presentation"
		class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
		onclick={(e) => handleBackdrop(e, () => (viewDialogOpen = false))}
	>
		<div
			class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
				<h2 class="truncate text-base font-bold text-white">{selectedMockup.name}</h2>
				<button
					type="button"
					class="text-slate-400 transition hover:text-accent-primary"
					onclick={() => (viewDialogOpen = false)}
					aria-label="Close"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-4">
				{#if views.length > 0}
					<!-- View tabs -->
					<div class="mb-4 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
						{#each views as view, i}
							<button
								type="button"
								class="border px-3 py-1.5 text-sm transition {currentViewIndex === i
									? 'border-accent-primary bg-accent-primary text-slate-950'
									: 'border-slate-700 bg-slate-800 text-slate-300 hover:text-accent-primary'}"
								onclick={() => (currentViewIndex = i)}
							>
								{view.label}
							</button>
						{/each}
					</div>

					<div class="flex items-center justify-center bg-slate-950" style="min-height: 50vh;">
						<img
							src={views[currentViewIndex].url}
							alt="{selectedMockup.name} - {views[currentViewIndex].label}"
							class="max-h-[60vh] max-w-full object-contain"
						/>
					</div>
				{:else}
					<div class="flex h-64 items-center justify-center text-slate-500">No images available</div>
				{/if}
			</div>

			<div class="flex flex-col gap-2 border-t border-slate-800 px-4 py-3 sm:flex-row sm:justify-between">
				<button
					type="button"
					class="inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
					onclick={() => (viewDialogOpen = false)}
				>
					Close
				</button>
				<div class="flex flex-col gap-2 sm:flex-row">
					{#if views.length > 0}
						<button
							type="button"
							class="inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
							onclick={() =>
								downloadImage(
									views[currentViewIndex].url,
									`${selectedMockup?.name || 'mockup'}-${views[currentViewIndex].label}.png`
								)}
						>
							<Download class="h-4 w-4" />
							Download {views[currentViewIndex].label}
						</button>
					{/if}
					<button
						type="button"
						class="inline-flex items-center justify-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90"
						onclick={() => {
							viewDialogOpen = false;
							if (selectedMockup) oneditMockup(selectedMockup);
						}}
					>
						<Pencil class="h-4 w-4" />
						Edit mockup
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Dialog (native modal) -->
{#if deleteDialogOpen}
	<div
		role="presentation"
		class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
		onclick={(e) => handleBackdrop(e, () => (deleteDialogOpen = false))}
	>
		<div class="w-full max-w-sm border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl">
			<h2 class="text-lg font-bold text-white">Delete mockup</h2>
			<p class="mt-1 text-sm text-slate-300">
				Are you sure you want to delete "{mockupToDelete?.name}"? This action cannot be undone.
			</p>
			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					class="inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary disabled:opacity-60"
					onclick={() => (deleteDialogOpen = false)}
					disabled={isDeleting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-2 border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
					onclick={deleteMockup}
					disabled={isDeleting}
				>
					{#if isDeleting}
						<Loader2 class="h-4 w-4 animate-spin" /> Deleting…
					{:else}
						<Trash2 class="h-4 w-4" /> Delete
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

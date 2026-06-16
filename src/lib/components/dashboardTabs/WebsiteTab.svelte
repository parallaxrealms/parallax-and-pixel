<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Page } from '$lib';
	import DiamondSpinner from '$lib/components/custom/loader/DiamondSpinner.svelte';
	// No icons - text-only design
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';

	interface Props {
		supabase: SupabaseClient;
	}

	let { supabase }: Props = $props();

	// State
	let pages = $state<Page[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Add Page dialog states
	let showAddPageDialog = $state(false);
	let newPageTitle = $state('');
	let newPageSlug = $state('');
	let newPageDescription = $state('');
	let slugManuallyEdited = $state(false);

	// Page settings dialog state
	let showPageSettingsDialog = $state(false);
	let editingPage = $state<Page | null>(null);
	let editPageMetaDescription = $state('');

	// Derived: separate static and custom pages
	let staticPages = $derived(pages.filter((p) => p.is_static));
	let customPages = $derived(pages.filter((p) => !p.is_static));

	// Load data on mount
	$effect(() => {
		loadData();
	});

	// Auto-generate slug from title unless manually edited
	$effect(() => {
		if (!slugManuallyEdited && newPageTitle) {
			newPageSlug = generateSlug(newPageTitle);
		}
	});

	function generateSlug(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	async function loadData() {
		loading = true;
		error = null;

		try {
			// Load pages
			const { data: pagesData, error: pagesError } = await supabase
				.from('pages')
				.select('*')
				.order('index_num', { ascending: true });

			if (pagesError) throw pagesError;
			pages = pagesData ?? [];
		} catch (e) {
			console.error('Error loading website data:', e);
			error = e instanceof Error ? e.message : 'Failed to load data';
		} finally {
			loading = false;
		}
	}

	// Page management
	async function addPage() {
		if (!newPageTitle.trim() || !newPageSlug.trim()) return;

		try {
			const maxIndex = pages.reduce((max, p) => Math.max(max, p.index_num), -1);

			const { data, error: insertError } = await supabase
				.from('pages')
				.insert({
					title: newPageTitle.trim(),
					slug: newPageSlug.trim(),
					status: 'draft',
					meta_description: newPageDescription.trim() || null,
					index_num: maxIndex + 1
				})
				.select()
				.single();

			if (insertError) throw insertError;

			pages = [...pages, data];
			resetNewPageForm();
			showAddPageDialog = false;

			// Navigate to editor for the new page
			goto(`/editor/${data.slug}`);
		} catch (e) {
			console.error('Error creating page:', e);
			alert('Failed to create page');
		}
	}

	function resetNewPageForm() {
		newPageTitle = '';
		newPageSlug = '';
		newPageDescription = '';
		slugManuallyEdited = false;
	}

	// Open page settings dialog
	function openPageSettingsDialog(page: Page) {
		editingPage = page;
		editPageMetaDescription = page.meta_description ?? '';
		showPageSettingsDialog = true;
	}

	// Update page settings
	async function updatePageSettings() {
		if (!editingPage) return;

		try {
			const { error: updateError } = await supabase
				.from('pages')
				.update({
					meta_description: editPageMetaDescription.trim() || null
				})
				.eq('id', editingPage.id);

			if (updateError) throw updateError;

			pages = pages.map((p) =>
				p.id === editingPage!.id
					? { ...p, meta_description: editPageMetaDescription.trim() || null }
					: p
			);

			showPageSettingsDialog = false;
			editingPage = null;
		} catch (e) {
			console.error('Error updating page settings:', e);
			alert('Failed to update page settings');
		}
	}

	// Delete page (only for non-static pages)
	async function deletePage(page: Page) {
		if (page.is_static) {
			alert('Static pages cannot be deleted');
			return;
		}

		if (!confirm(`Delete "${page.title}"? This action cannot be undone.`)) return;

		try {
			const { error: deleteError } = await supabase
				.from('pages')
				.delete()
				.eq('id', page.id);

			if (deleteError) throw deleteError;

			pages = pages.filter((p) => p.id !== page.id);
		} catch (e) {
			console.error('Error deleting page:', e);
			alert('Failed to delete page');
		}
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'published':
				return 'bg-emerald-500/15 text-emerald-400';
			case 'draft':
				return 'bg-amber-500/15 text-amber-400';
			case 'scheduled':
				return 'bg-accent-primary/20 text-accent-primary';
			default:
				return 'bg-slate-700 text-slate-300';
		}
	}
</script>

<div class="mx-auto max-w-6xl">
	<!-- Header -->
	<header class="mb-6">
		<h1 class="text-2xl font-bold text-white">Pages &amp; Links</h1>
		<p class="mt-1 text-sm text-slate-400">Manage your blog posts and navigation.</p>
	</header>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<DiamondSpinner size="lg" text="Loading..." />
		</div>
	{:else if error}
		<div class="flex flex-col gap-2 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 sm:flex-row sm:items-center">
			<span><span class="font-semibold">ERROR:</span> {error}</span>
			<button
				type="button"
				onclick={loadData}
				class="inline-flex items-center justify-center border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/20 sm:ml-auto"
			>
				Retry
			</button>
		</div>
	{:else}
		<!-- Pages Section -->
		<div class="border border-slate-800 bg-slate-900/50 p-4">
			<div class="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-center sm:justify-between">
				<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Blog Posts</h2>
				<button
					type="button"
					onclick={() => (showAddPageDialog = true)}
					class="inline-flex items-center justify-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90"
				>
					+ New Post
				</button>
			</div>

			{#if pages.length === 0}
				<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500">
					No pages yet
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					{#each customPages as page (page.id)}
						<div class="flex flex-col gap-3 border border-slate-800 bg-slate-950 p-3 transition hover:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="truncate text-sm font-medium text-white">{page.title}</span>
									<span class="inline-block px-2 py-0.5 text-xs font-medium uppercase tracking-wider {getStatusBadgeClass(page.status)}">{page.status}</span>
									{#if page.status === 'scheduled' && page.page_options?.scheduled_at}
										<span class="text-xs text-slate-500">{new Date(page.page_options.scheduled_at as string).toLocaleString()}</span>
									{/if}
								</div>
								<span class="mt-0.5 block truncate text-xs text-slate-500">/blog/{page.slug}</span>
							</div>
							<div class="flex shrink-0 flex-wrap gap-2">
								<button
									type="button"
									onclick={() => goto(`/editor/${page.slug}`)}
									class="inline-flex items-center justify-center border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:text-accent-primary disabled:opacity-60"
									aria-label="Edit"
									disabled={!!$navigating}
								>
									{#if $navigating?.to?.url.pathname === `/editor/${page.slug}`}<span class="animate-pulse text-accent-primary">...</span>{:else}Edit{/if}
								</button>
								{#if page.status === 'published'}
									<button
										type="button"
										onclick={() => goto(`/blog/${page.slug}`)}
										class="inline-flex items-center justify-center border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:text-accent-primary"
										aria-label="View"
									>
										View
									</button>
								{/if}
								<button
									type="button"
									onclick={() => openPageSettingsDialog(page)}
									class="inline-flex items-center justify-center border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:text-accent-primary"
									aria-label="Settings"
								>
									Set
								</button>
								<button
									type="button"
									onclick={() => deletePage(page)}
									class="inline-flex items-center justify-center border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/20"
									aria-label="Delete"
								>
									Del
								</button>
							</div>
						</div>
					{/each}

					{#if staticPages.length > 0}
						<div class="my-2 border-t border-dashed border-slate-800 pt-3">
							<span class="text-xs uppercase tracking-wider text-slate-500">Static Pages</span>
						</div>
						{#each staticPages as page (page.id)}
							<div class="flex flex-col gap-3 border border-slate-800 bg-slate-950 p-3 opacity-70 transition hover:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="truncate text-sm font-medium text-white">{page.title}</span>
										<span class="inline-block px-2 py-0.5 text-xs font-medium uppercase tracking-wider {getStatusBadgeClass(page.status)}">{page.status}</span>
									</div>
									<span class="mt-0.5 block truncate text-xs text-slate-500">/{page.slug || '(home)'}</span>
								</div>
								<div class="flex shrink-0 flex-wrap gap-2">
									<button
										type="button"
										onclick={() => goto(`/${page.slug}`)}
										class="inline-flex items-center justify-center border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:text-accent-primary"
										aria-label="View"
									>
										View
									</button>
									<button
										type="button"
										onclick={() => openPageSettingsDialog(page)}
										class="inline-flex items-center justify-center border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:text-accent-primary"
										aria-label="Settings"
									>
										Set
									</button>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Add Page Dialog -->
{#if showAddPageDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<button
			type="button"
			aria-label="Close dialog"
			class="absolute inset-0 cursor-default"
			onclick={() => {
				showAddPageDialog = false;
				resetNewPageForm();
			}}
		></button>
		<div class="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto border border-slate-700 bg-slate-900 p-6">
			<header class="mb-4">
				<h2 class="text-lg font-bold text-white">New Blog Post</h2>
				<p class="mt-0.5 text-sm text-slate-400">Create a new blog post.</p>
			</header>
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<label for="page-title" class="text-sm text-slate-300">Title</label>
					<input
						id="page-title"
						placeholder="e.g. My First Post"
						bind:value={newPageTitle}
						class="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="page-slug" class="text-sm text-slate-300">URL Slug</label>
					<input
						id="page-slug"
						placeholder="e.g. my-first-post"
						bind:value={newPageSlug}
						oninput={() => (slugManuallyEdited = true)}
						class="w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
					/>
					<p class="text-xs text-slate-500">/blog/{newPageSlug || 'slug'}</p>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="page-description" class="text-sm text-slate-300">Meta Description (optional)</label>
					<textarea
						id="page-description"
						placeholder="Brief description for search engines..."
						bind:value={newPageDescription}
						rows={2}
						class="w-full resize-y border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
					></textarea>
				</div>
			</div>
			<div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
				<button
					type="button"
					onclick={() => {
						showAddPageDialog = false;
						resetNewPageForm();
					}}
					class="inline-flex items-center justify-center border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={addPage}
					disabled={!newPageTitle.trim() || !newPageSlug.trim()}
					class="inline-flex items-center justify-center bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:opacity-60"
				>
					Create &amp; Edit
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Page Settings Dialog -->
{#if showPageSettingsDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<button
			type="button"
			aria-label="Close dialog"
			class="absolute inset-0 cursor-default"
			onclick={() => {
				showPageSettingsDialog = false;
				editingPage = null;
			}}
		></button>
		<div class="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto border border-slate-700 bg-slate-900 p-6">
			<header class="mb-4">
				<h2 class="text-lg font-bold text-white">Page Settings</h2>
				<p class="mt-0.5 text-sm text-slate-400">{editingPage?.title}</p>
			</header>
			<div class="flex flex-col gap-4">
				{#if editingPage?.is_static}
					<div class="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
						Static page - URL cannot be changed
					</div>
				{/if}
				<div class="flex flex-col gap-1.5">
					<label for="settings-meta-description" class="text-sm text-slate-300">Meta Description</label>
					<textarea
						id="settings-meta-description"
						placeholder="Brief description for search engines..."
						bind:value={editPageMetaDescription}
						rows={3}
						class="w-full resize-y border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none"
					></textarea>
					<p class="text-xs text-slate-500">Used by search engines</p>
				</div>
			</div>
			<div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
				<button
					type="button"
					onclick={() => {
						showPageSettingsDialog = false;
						editingPage = null;
					}}
					class="inline-flex items-center justify-center border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={updatePageSettings}
					class="inline-flex items-center justify-center bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90"
				>
					Save Settings
				</button>
			</div>
		</div>
	</div>
{/if}

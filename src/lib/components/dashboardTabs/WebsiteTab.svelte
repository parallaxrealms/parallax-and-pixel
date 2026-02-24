<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Page } from '$lib';
	import { Button } from '@parallaxrealms/components-core';
	import * as Card from '@parallaxrealms/components-core/shadcn/card';
	import { Input } from '@parallaxrealms/components-core/shadcn/input';
	import { Label } from '@parallaxrealms/components-core/shadcn/label';
	import * as Dialog from '@parallaxrealms/components-core/shadcn/dialog';
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

	function getStatusBadgeClass(status: string) {
		switch (status) {
			case 'published':
				return 'status-published';
			case 'draft':
				return 'status-draft';
			case 'scheduled':
				return 'status-scheduled';
			default:
				return 'status-default';
		}
	}
</script>

<div class="website-tab">
	<!-- Header -->
	<div class="header-section">
		<h1 class="text-2xl md:text-3xl">
			<span class="font-rubik text-accent-primary">Pages</span>
			<span class="text-slate-500">&</span>
			<span class="font-fade text-accent-highlight">Links</span>
		</h1>
		<p class="font-terminal mt-1 text-slate-400">
			Manage your blog posts and navigation
		</p>
	</div>

	{#if loading}
		<div class="loading-container">
			<DiamondSpinner size="lg" text="Loading..." />
		</div>
	{:else if error}
		<div class="cyber-alert">
			<span class="font-terminal text-accent-highlight">ERROR:</span>
			<span class="font-terminal ml-2">{error}</span>
			<button type="button" onclick={loadData} class="retry-btn">Retry</button>
		</div>
	{:else}
		<div class="content-grid">
			<!-- Pages Section -->
			<div class="section-card">
				<div class="section-header">
					<h2 class="font-fade text-lg text-accent-primary">Blog Posts</h2>
					<button type="button" onclick={() => (showAddPageDialog = true)} class="add-btn">
						<span class="font-terminal">+ New Post</span>
					</button>
				</div>

				{#if pages.length === 0}
					<div class="empty-state">
						<p class="font-terminal text-lg text-slate-500">No pages yet</p>
					</div>
				{:else}
					<div class="items-list">
						{#each customPages as page (page.id)}
							<div class="page-item">
								<div class="page-info">
									<div class="page-header">
										<span class="font-terminal page-title">{page.title}</span>
										<span class="status-badge {getStatusBadgeClass(page.status)}">{page.status}</span>
										{#if page.status === 'scheduled' && page.page_options?.scheduled_at}
											<span class="font-terminal text-xs text-slate-500">{new Date(page.page_options.scheduled_at as string).toLocaleString()}</span>
										{/if}
									</div>
									<span class="font-terminal page-slug">/blog/{page.slug}</span>
								</div>
								<div class="page-actions">
									<button
										type="button"
										onclick={() => goto(`/editor/${page.slug}`)}
										class="action-btn edit font-terminal text-xs"
										aria-label="Edit"
										disabled={!!$navigating}
									>
										{#if $navigating?.to?.url.pathname === `/editor/${page.slug}`}<span class="loading-dots">...</span>{:else}Edit{/if}
									</button>
									{#if page.status === 'published'}
										<button
											type="button"
											onclick={() => goto(`/blog/${page.slug}`)}
											class="action-btn view font-terminal text-xs"
											aria-label="View"
										>
											View
										</button>
									{/if}
									<button
										type="button"
										onclick={() => openPageSettingsDialog(page)}
										class="action-btn settings font-terminal text-xs"
										aria-label="Settings"
									>
										Set
									</button>
									<button
										type="button"
										onclick={() => deletePage(page)}
										class="action-btn delete font-terminal text-xs"
										aria-label="Delete"
									>
										Del
									</button>
								</div>
							</div>
						{/each}

						{#if staticPages.length > 0}
							<div class="divider">
								<span class="font-terminal text-xs text-accent-secondary">Static Pages</span>
							</div>
							{#each staticPages as page (page.id)}
								<div class="page-item static">
									<div class="page-info">
										<div class="page-header">
											<span class="font-terminal page-title">{page.title}</span>
											<span class="status-badge {getStatusBadgeClass(page.status)}">{page.status}</span>
										</div>
										<span class="font-terminal page-slug">/{page.slug || '(home)'}</span>
									</div>
									<div class="page-actions">
										<button
											type="button"
											onclick={() => goto(`/${page.slug}`)}
											class="action-btn view font-terminal text-xs"
											aria-label="View"
										>
											View
										</button>
										<button
											type="button"
											onclick={() => openPageSettingsDialog(page)}
											class="action-btn settings font-terminal text-xs"
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
		</div>
	{/if}
</div>

<!-- Add Page Dialog -->
<Dialog.Root bind:open={showAddPageDialog}>
	<Dialog.Content class="dialog-content">
		<Dialog.Header>
			<Dialog.Title class="font-rubik text-accent-primary">New Blog Post</Dialog.Title>
			<Dialog.Description class="font-terminal">Create a new blog post.</Dialog.Description>
		</Dialog.Header>
		<div class="dialog-body">
			<div class="form-group">
				<Label for="page-title" class="font-terminal">Title</Label>
				<Input id="page-title" placeholder="e.g. My First Post" bind:value={newPageTitle} class="cyber-input" />
			</div>
			<div class="form-group">
				<Label for="page-slug" class="font-terminal">URL Slug</Label>
				<Input
					id="page-slug"
					placeholder="e.g. my-first-post"
					bind:value={newPageSlug}
					oninput={() => (slugManuallyEdited = true)}
					class="cyber-input"
				/>
				<p class="font-terminal text-xs text-slate-500 mt-1">/blog/{newPageSlug || 'slug'}</p>
			</div>
			<div class="form-group">
				<Label for="page-description" class="font-terminal">Meta Description (optional)</Label>
				<textarea
					id="page-description"
					placeholder="Brief description for search engines..."
					bind:value={newPageDescription}
					rows={2}
					class="cyber-textarea"
				></textarea>
			</div>
		</div>
		<Dialog.Footer>
			<Button
				variant="outlined"
				onclick={() => {
					showAddPageDialog = false;
					resetNewPageForm();
				}}
			>
				Cancel
			</Button>
			<Button onclick={addPage} disabled={!newPageTitle.trim() || !newPageSlug.trim()} class="primary-btn">
				Create & Edit
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Page Settings Dialog -->
<Dialog.Root bind:open={showPageSettingsDialog}>
	<Dialog.Content class="dialog-content">
		<Dialog.Header>
			<Dialog.Title class="font-rubik text-accent-secondary">Page Settings</Dialog.Title>
			<Dialog.Description class="font-terminal">{editingPage?.title}</Dialog.Description>
		</Dialog.Header>
		<div class="dialog-body">
			{#if editingPage?.is_static}
				<div class="static-warning">
					<span class="font-terminal text-sm text-accent-secondary">Static page - URL cannot be changed</span>
				</div>
			{/if}
			<div class="form-group">
				<Label for="settings-meta-description" class="font-terminal">Meta Description</Label>
				<textarea
					id="settings-meta-description"
					placeholder="Brief description for search engines..."
					bind:value={editPageMetaDescription}
					rows={3}
					class="cyber-textarea"
				></textarea>
				<p class="font-terminal text-xs text-slate-500 mt-1">Used by search engines</p>
			</div>
		</div>
		<Dialog.Footer>
			<Button
				variant="outlined"
				onclick={() => {
					showPageSettingsDialog = false;
					editingPage = null;
				}}
			>
				Cancel
			</Button>
			<Button onclick={updatePageSettings} class="primary-btn">Save Settings</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.website-tab {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.header-section {
		text-align: center;
		padding: 1rem 0;
	}

	/* Loading */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 4rem;
	}

	/* Error */
	.cyber-alert {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid var(--accent-highlight);
		background: rgba(255, 0, 255, 0.1);
		border-radius: 0.5rem;
	}

	.retry-btn {
		margin-left: auto;
		padding: 0.25rem 0.75rem;
		background: var(--accent-highlight);
		color: #000;
		border: none;
		border-radius: 0.25rem;
		font-family: 'Space Mono', monospace;
		cursor: pointer;
	}

	/* Content Grid */
	.content-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}

	@media (min-width: 1024px) {
		.content-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	/* Section Card */
	.section-card {
		background: rgba(23, 23, 23, 0.5);
		border: 1px solid #3f3f46;
		border-radius: 0.75rem;
		padding: 1.25rem;
		backdrop-filter: blur(10px);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #3f3f46;
	}

	.section-title-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Add Button */
	.add-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		background: var(--accent-primary);
		color: #000;
		border: none;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.add-btn:hover {
		background: var(--accent-highlight);
		transform: translateY(-1px);
	}

	.add-btn.secondary {
		background: transparent;
		color: var(--accent-highlight);
		border: 1px solid var(--accent-highlight);
	}

	.add-btn.secondary:hover {
		background: rgba(255, 0, 255, 0.1);
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		gap: 0.5rem;
	}

	/* Items List */
	.items-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Page Item */
	.page-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #3f3f46;
		border-radius: 0.5rem;
		transition: all 0.2s;
	}

	.page-item:hover {
		border-color: var(--accent-primary);
		background: rgba(0, 255, 255, 0.05);
	}

	.page-item.static {
		opacity: 0.7;
	}

	.page-item.static:hover {
		border-color: var(--accent-secondary);
		background: rgba(255, 191, 0, 0.05);
	}

	.page-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
	}

	.page-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-title {
		font-size: 0.875rem;
		color: #fafafa;
	}

	.page-slug {
		font-size: 0.75rem;
		color: #71717a;
	}

	/* Status Badge */
	.status-badge {
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		font-family: 'Space Mono', monospace;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-published {
		background: rgba(0, 255, 255, 0.2);
		color: var(--accent-primary);
	}

	.status-draft {
		background: rgba(255, 191, 0, 0.2);
		color: var(--accent-secondary);
	}

	.status-scheduled {
		background: rgba(139, 92, 246, 0.2);
		color: #a78bfa;
	}

	.status-default {
		background: rgba(255, 255, 255, 0.1);
		color: #a3a3a3;
	}

	/* Actions */
	.page-actions,
	.link-actions {
		display: flex;
		gap: 0.25rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: 1px solid #3f3f46;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.action-btn:disabled {
		cursor: wait;
		pointer-events: none;
	}

	.action-btn.edit {
		color: var(--accent-primary);
	}

	.action-btn.edit:hover {
		background: rgba(0, 255, 255, 0.1);
		border-color: var(--accent-primary);
	}

	.action-btn.view {
		color: var(--accent-highlight);
	}

	.action-btn.view:hover {
		background: rgba(255, 0, 255, 0.1);
		border-color: var(--accent-highlight);
	}

	.action-btn.settings {
		color: var(--accent-secondary);
	}

	.action-btn.settings:hover {
		background: rgba(255, 191, 0, 0.1);
		border-color: var(--accent-secondary);
	}

	.action-btn.delete {
		color: #ef4444;
	}

	.action-btn.delete:hover {
		background: rgba(239, 68, 68, 0.1);
		border-color: #ef4444;
	}

	.action-btn.toggle {
		color: #a3a3a3;
	}

	.action-btn.toggle:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	/* Link Item */
	.link-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #3f3f46;
		border-radius: 0.5rem;
		transition: all 0.2s;
	}

	.link-item:hover {
		border-color: var(--accent-highlight);
		background: rgba(255, 0, 255, 0.05);
	}

	.link-item.inactive {
		opacity: 0.5;
	}

	.link-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.link-name {
		font-size: 0.875rem;
		color: #fafafa;
	}

	.hidden-badge {
		padding: 0.125rem 0.375rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 0.25rem;
		font-family: 'Space Mono', monospace;
		font-size: 0.625rem;
		color: #71717a;
	}

	/* Divider */
	.divider {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		margin: 0.5rem 0;
		border-top: 1px dashed #3f3f46;
	}

	/* Dialog Styles */
	:global(.dialog-content) {
		background: rgba(23, 23, 23, 0.95) !important;
		border: 1px solid #3f3f46 !important;
		backdrop-filter: blur(10px);
	}

	.dialog-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 0;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.checkbox-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	:global(.cyber-input) {
		background: rgba(0, 0, 0, 0.3) !important;
		border-color: #3f3f46 !important;
	}

	:global(.cyber-input:focus) {
		border-color: var(--accent-primary) !important;
	}

	.cyber-textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #3f3f46;
		border-radius: 0.375rem;
		font-family: 'Space Mono', monospace;
		font-size: 0.875rem;
		color: #fafafa;
		resize: vertical;
	}

	.cyber-textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.static-warning {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: rgba(255, 191, 0, 0.1);
		border: 1px solid var(--accent-secondary);
		border-radius: 0.375rem;
	}

	:global(.primary-btn) {
		background: var(--accent-primary) !important;
		color: #000 !important;
	}

	:global(.primary-btn:hover) {
		background: var(--accent-highlight) !important;
	}

	/* Light mode */
	:global(.light) .section-card {
		background: rgba(250, 250, 250, 0.9);
		border-color: #e5e5e5;
	}

	:global(.light) .page-item,
	:global(.light) .link-item {
		background: rgba(255, 255, 255, 0.5);
		border-color: #e5e5e5;
	}

	:global(.light) .page-title,
	:global(.light) .link-name {
		color: #171717;
	}

	.loading-dots {
		color: var(--accent-primary);
		animation: pulse-dots 1s ease-in-out infinite;
	}

	@keyframes pulse-dots {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
</style>

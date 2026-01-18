<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import { Button, Card, Badge } from '@parallaxrealms/components-core';
	import { selectedTab } from '@parallaxrealms/stores-core';
	import { goto } from '$app/navigation';
	import DiamondSpinner from '$lib/components/custom/loader/DiamondSpinner.svelte';

	let { supabase } = $props<{
		supabase: SupabaseClient;
	}>();

	// State
	let isLoading = $state(true);
	let pages = $state<any[]>([]);
	let error = $state<string | null>(null);

	// Computed stats
	let totalPosts = $derived(pages.length);
	let publishedPosts = $derived(pages.filter((p) => p.status === 'published').length);
	let draftPosts = $derived(pages.filter((p) => p.status === 'draft').length);
	let recentPosts = $derived(pages.slice(0, 5));

	// Load pages from database
	async function loadPages() {
		if (!browser || !supabase) return;

		isLoading = true;
		try {
			const { data, error: fetchError } = await supabase
				.schema('pxp')
				.from('pages')
				.select('*')
				.order('updated_at', { ascending: false });

			if (fetchError) throw fetchError;
			pages = data || [];
		} catch (err) {
			console.error('Error loading pages:', err);
			error = err instanceof Error ? err.message : 'Failed to load pages';
		} finally {
			isLoading = false;
		}
	}

	function goToPages() {
		selectedTab.set('website');
	}

	function editPage(slug: string) {
		goto(`/editor/${slug}`);
	}

	function viewPage(slug: string) {
		goto(`/blog/${slug}`);
	}

	// Load pages on mount
	$effect(() => {
		loadPages();
	});
</script>

<div class="dashboard-home">
	<!-- Welcome Header with Glitch Effect -->
	<div class="welcome-section">
		<h1 class="glitch-text text-3xl md:text-4xl">
			<span class="font-pixel text-accent-primary">Command</span>
			<span class="font-terminal text-slate-50"> // </span>
			<span class="font-pixel text-accent-highlight">Center</span>
		</h1>
		<p class="font-terminal mt-2 text-slate-400">
			Manage your blog posts and site content
		</p>
	</div>

	{#if isLoading}
		<div class="loading-container">
			<DiamondSpinner size="lg" text="Initializing..." />
		</div>
	{:else if error}
		<div class="cyber-alert">
			<span class="font-terminal text-accent-highlight">ERROR:</span>
			<span class="font-terminal ml-2">{error}</span>
		</div>
	{:else}
		<!-- Stats Grid -->
		<div class="stats-grid">
			<div class="stat-card stat-total">
				<div class="stat-content">
					<span class="font-terminal stat-number">{totalPosts}</span>
					<span class="font-terminal stat-label">Total Posts</span>
				</div>
			</div>

			<div class="stat-card stat-published">
				<div class="stat-content">
					<span class="font-terminal stat-number">{publishedPosts}</span>
					<span class="font-terminal stat-label">Published</span>
				</div>
			</div>

			<div class="stat-card stat-drafts">
				<div class="stat-content">
					<span class="font-terminal stat-number">{draftPosts}</span>
					<span class="font-terminal stat-label">Drafts</span>
				</div>
			</div>
		</div>

		<!-- Quick Actions -->
		<div class="actions-section">
			<button type="button" onclick={() => goto('/editor/new')} class="cta-button">
				<span class="font-terminal">+ New Post</span>
			</button>
			<button type="button" onclick={goToPages} class="secondary-button">
				<span class="font-terminal">Manage Pages</span>
			</button>
		</div>

		<!-- Recent Posts -->
		<div class="recent-section">
			<h2 class="font-fade section-title">
				<span class="text-accent-secondary">Recent</span> Posts
			</h2>

			{#if recentPosts.length === 0}
				<div class="empty-state">
					<p class="font-terminal text-lg text-slate-500">No posts yet</p>
					<p class="font-terminal text-sm text-slate-400">Create your first post to get started</p>
				</div>
			{:else}
				<div class="posts-list">
					{#each recentPosts as post}
						<div class="post-item">
							<div class="post-info">
								<h3 class="font-terminal post-title">{post.title || 'Untitled'}</h3>
								<div class="post-meta">
									<Badge
										variant={post.status === 'published' ? 'default' : 'outlined'}
										size="sm"
										class={post.status === 'published' ? 'status-published' : 'status-draft'}
									>
										{post.status}
									</Badge>
									<span class="font-terminal post-date">
										{new Date(post.updated_at).toLocaleDateString()}
									</span>
								</div>
							</div>
							<div class="post-actions">
								<button
									type="button"
									onclick={() => editPage(post.slug)}
									class="action-btn edit-btn font-terminal text-xs"
									aria-label="Edit post"
								>
									Edit
								</button>
								{#if post.status === 'published'}
									<button
										type="button"
										onclick={() => viewPage(post.slug)}
										class="action-btn view-btn font-terminal text-xs"
										aria-label="View post"
									>
										View
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.dashboard-home {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	/* Welcome Section */
	.welcome-section {
		text-align: center;
		padding: 2rem 0;
	}

	.glitch-text {
		position: relative;
		display: inline-block;
	}

	.glitch-text:hover {
		animation: glitch 0.3s infinite;
	}

	@keyframes glitch {
		0% {
			text-shadow:
				2px 0 var(--accent-primary),
				-2px 0 var(--accent-highlight);
		}
		25% {
			text-shadow:
				-2px 0 var(--accent-primary),
				2px 0 var(--accent-highlight);
		}
		50% {
			text-shadow:
				2px 0 var(--accent-highlight),
				-2px 0 var(--accent-primary);
		}
		75% {
			text-shadow:
				-2px 0 var(--accent-highlight),
				2px 0 var(--accent-primary);
		}
		100% {
			text-shadow:
				2px 0 var(--accent-primary),
				-2px 0 var(--accent-highlight);
		}
	}

	/* Loading */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem;
	}

	/* Error Alert */
	.cyber-alert {
		padding: 1rem;
		border: 1px solid var(--accent-highlight);
		background: rgba(255, 0, 255, 0.1);
		border-radius: 0.5rem;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.stats-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		border: 1px solid #334155; /* slate-700 */
		background: rgba(30, 41, 59, 0.5); /* slate-800 */
		backdrop-filter: blur(10px);
		transition: all 0.3s ease;
	}

	.stat-card:hover {
		transform: translateY(-2px);
	}

	.stat-total {
		border-color: var(--accent-primary);
	}

	.stat-total .stat-icon {
		color: var(--accent-primary);
	}

	.stat-total .stat-number {
		color: var(--accent-primary);
	}

	.stat-published {
		border-color: var(--accent-highlight);
	}

	.stat-published .stat-icon {
		color: var(--accent-highlight);
	}

	.stat-published .stat-number {
		color: var(--accent-highlight);
	}

	.stat-drafts {
		border-color: var(--accent-secondary);
	}

	.stat-drafts .stat-icon {
		color: var(--accent-secondary);
	}

	.stat-drafts .stat-number {
		color: var(--accent-secondary);
	}

	.stat-content {
		display: flex;
		flex-direction: column;
	}

	.stat-number {
		font-size: 2rem;
		line-height: 1;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #94a3b8; /* slate-400 */
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Actions */
	.actions-section {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.cta-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: var(--accent-primary);
		color: #000;
		border: none;
		border-radius: 0.5rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cta-button:hover {
		background: var(--accent-highlight);
		transform: translateY(-2px);
		box-shadow: 0 4px 20px rgba(255, 0, 255, 0.3);
	}

	.secondary-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: transparent;
		color: var(--accent-secondary);
		border: 1px solid var(--accent-secondary);
		border-radius: 0.5rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.secondary-button:hover {
		background: rgba(255, 191, 0, 0.1);
		transform: translateY(-2px);
	}

	/* Recent Section */
	.recent-section {
		background: rgba(30, 41, 59, 0.5); /* slate-800 */
		border: 1px solid #334155; /* slate-700 */
		padding: 1.5rem;
		backdrop-filter: blur(10px);
	}

	.section-title {
		font-size: 1.25rem;
		margin-bottom: 1.5rem;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 3rem;
		text-align: center;
	}

	/* Posts List */
	.posts-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.post-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border: 1px solid #334155; /* slate-700 */
		background: rgba(15, 23, 42, 0.5); /* slate-900 */
		transition: all 0.2s ease;
	}

	.post-item:hover {
		border-color: var(--accent-primary);
		background: rgba(0, 255, 255, 0.05);
	}

	.post-info {
		flex: 1;
		min-width: 0;
	}

	.post-title {
		font-size: 1rem;
		color: #f8fafc; /* slate-50 */
		margin-bottom: 0.25rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.post-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.post-date {
		font-size: 0.75rem;
		color: #64748b; /* slate-500 */
	}

	:global(.status-published) {
		background: rgba(0, 255, 255, 0.2) !important;
		color: var(--accent-primary) !important;
		border-color: var(--accent-primary) !important;
	}

	:global(.status-draft) {
		background: transparent !important;
		color: var(--accent-secondary) !important;
		border-color: var(--accent-secondary) !important;
	}

	.post-actions {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem 0.5rem;
		border: 1px solid #334155; /* slate-700 */
		background: transparent;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.edit-btn {
		color: var(--accent-primary);
	}

	.edit-btn:hover {
		background: rgba(0, 255, 255, 0.1);
		border-color: var(--accent-primary);
	}

	.view-btn {
		color: var(--accent-highlight);
	}

	.view-btn:hover {
		background: rgba(255, 0, 255, 0.1);
		border-color: var(--accent-highlight);
	}

</style>

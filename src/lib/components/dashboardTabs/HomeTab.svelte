<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import { Button, Card, Badge } from '@parallaxrealms/components-core';
	import { selectedTab } from '@parallaxrealms/stores-core';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import DiamondSpinner from '$lib/components/custom/loader/DiamondSpinner.svelte';

	let { supabase } = $props<{
		supabase: SupabaseClient;
	}>();

	// State
	let isLoading = $state(true);
	let pages = $state<any[]>([]);
	let error = $state<string | null>(null);

	// Social stats
	let socialPostsTotal = $state(0);
	let socialPostsSuccess = $state(0);
	let socialPostsFailed = $state(0);
	let integrationCount = $state(0);

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
			const [pagesRes, socialRes, integrationsRes] = await Promise.all([
				supabase
					.from('pages')
					.select('*')
					.order('updated_at', { ascending: false }),
				fetch('/api/social/history?limit=1').then((r) => r.ok ? r.json() : null).catch(() => null),
				fetch('/api/social/integrations').then((r) => r.ok ? r.json() : null).catch(() => null)
			]);

			if (pagesRes.error) throw pagesRes.error;
			pages = pagesRes.data || [];

			// Social stats
			if (socialRes) {
				socialPostsTotal = socialRes.total || 0;
			}
			if (integrationsRes) {
				integrationCount = (integrationsRes.integrations || []).filter((i: any) => i.is_enabled && i.has_credentials).length;
			}

			// Get success/failed counts separately
			const [successRes, failedRes] = await Promise.all([
				fetch('/api/social/history?limit=1&status=success').then((r) => r.ok ? r.json() : null).catch(() => null),
				fetch('/api/social/history?limit=1&status=failed').then((r) => r.ok ? r.json() : null).catch(() => null)
			]);
			socialPostsSuccess = successRes?.total || 0;
			socialPostsFailed = failedRes?.total || 0;
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

		<!-- Social Stats -->
		{#if socialPostsTotal > 0 || integrationCount > 0}
			<div class="social-stats-section">
				<h2 class="font-fade section-title">
					<span class="text-accent-primary">Social</span> Media
				</h2>
				<div class="stats-grid stats-grid-4">
					<div class="stat-card stat-social-platforms">
						<div class="stat-content">
							<span class="font-terminal stat-number">{integrationCount}</span>
							<span class="font-terminal stat-label">Platforms</span>
						</div>
					</div>
					<div class="stat-card stat-social-total">
						<div class="stat-content">
							<span class="font-terminal stat-number">{socialPostsTotal}</span>
							<span class="font-terminal stat-label">Posts Sent</span>
						</div>
					</div>
					<div class="stat-card stat-social-success">
						<div class="stat-content">
							<span class="font-terminal stat-number">{socialPostsSuccess}</span>
							<span class="font-terminal stat-label">Delivered</span>
						</div>
					</div>
					<div class="stat-card stat-social-failed">
						<div class="stat-content">
							<span class="font-terminal stat-number">{socialPostsFailed}</span>
							<span class="font-terminal stat-label">Failed</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Quick Actions -->
		<div class="actions-section">
			<button type="button" onclick={() => goto('/editor/new')} class="cta-button" disabled={!!$navigating}>
				<span class="font-terminal">
					{#if $navigating?.to?.url.pathname === '/editor/new'}Loading...{:else}+ New Post{/if}
				</span>
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
									disabled={!!$navigating}
								>
									{#if $navigating?.to?.url.pathname === `/editor/${post.slug}`}<span class="loading-dots">...</span>{:else}Edit{/if}
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

	.stat-total .stat-number {
		color: var(--accent-primary);
	}

	.stat-published {
		border-color: var(--accent-highlight);
	}

	.stat-published .stat-number {
		color: var(--accent-highlight);
	}

	.stat-drafts {
		border-color: var(--accent-secondary);
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

	.stats-grid-4 {
		grid-template-columns: repeat(2, 1fr);
	}

	@media (min-width: 640px) {
		.stats-grid-4 {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.social-stats-section {
		margin-top: -0.5rem;
	}

	.social-stats-section .section-title {
		margin-bottom: 1rem;
	}

	.stat-social-platforms {
		border-color: #8b5cf6;
	}

	.stat-social-platforms .stat-number {
		color: #8b5cf6;
	}

	.stat-social-total {
		border-color: var(--accent-primary);
	}

	.stat-social-total .stat-number {
		color: var(--accent-primary);
	}

	.stat-social-success {
		border-color: var(--accent-highlight);
	}

	.stat-social-success .stat-number {
		color: var(--accent-highlight);
	}

	.stat-social-failed {
		border-color: #ef4444;
	}

	.stat-social-failed .stat-number {
		color: #ef4444;
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

	.action-btn:disabled,
	.cta-button:disabled {
		cursor: wait;
		pointer-events: none;
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

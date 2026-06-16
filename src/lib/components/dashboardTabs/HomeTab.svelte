<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import { selectedTab } from '@parallaxrealms/pxp-utils/stores-core';
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

<div class="mx-auto max-w-6xl">
	<!-- Header -->
	<header class="mb-6">
		<h1 class="text-2xl font-bold text-white">Command Center</h1>
		<p class="mt-1 text-sm text-slate-400">Manage your blog posts and site content.</p>
	</header>

	{#if isLoading}
		<div class="flex items-center justify-center py-16">
			<DiamondSpinner size="lg" text="Initializing..." />
		</div>
	{:else if error}
		<div class="mb-6 flex items-center gap-2 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
			<span class="font-semibold">ERROR:</span>
			<span>{error}</span>
		</div>
	{:else}
		<!-- Stats Grid -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="border border-slate-800 bg-slate-900/50 p-4">
				<div class="flex flex-col">
					<span class="text-2xl font-bold text-accent-primary">{totalPosts}</span>
					<span class="mt-1 text-xs uppercase tracking-wider text-slate-400">Total Posts</span>
				</div>
			</div>

			<div class="border border-slate-800 bg-slate-900/50 p-4">
				<div class="flex flex-col">
					<span class="text-2xl font-bold text-emerald-400">{publishedPosts}</span>
					<span class="mt-1 text-xs uppercase tracking-wider text-slate-400">Published</span>
				</div>
			</div>

			<div class="border border-slate-800 bg-slate-900/50 p-4">
				<div class="flex flex-col">
					<span class="text-2xl font-bold text-amber-400">{draftPosts}</span>
					<span class="mt-1 text-xs uppercase tracking-wider text-slate-400">Drafts</span>
				</div>
			</div>
		</div>

		<!-- Social Stats -->
		{#if socialPostsTotal > 0 || integrationCount > 0}
			<div class="mt-6">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Social Media</h2>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div class="border border-slate-800 bg-slate-900/50 p-4">
						<div class="flex flex-col">
							<span class="text-2xl font-bold text-accent-primary">{integrationCount}</span>
							<span class="mt-1 text-xs uppercase tracking-wider text-slate-400">Platforms</span>
						</div>
					</div>
					<div class="border border-slate-800 bg-slate-900/50 p-4">
						<div class="flex flex-col">
							<span class="text-2xl font-bold text-accent-primary">{socialPostsTotal}</span>
							<span class="mt-1 text-xs uppercase tracking-wider text-slate-400">Posts Sent</span>
						</div>
					</div>
					<div class="border border-slate-800 bg-slate-900/50 p-4">
						<div class="flex flex-col">
							<span class="text-2xl font-bold text-emerald-400">{socialPostsSuccess}</span>
							<span class="mt-1 text-xs uppercase tracking-wider text-slate-400">Delivered</span>
						</div>
					</div>
					<div class="border border-slate-800 bg-slate-900/50 p-4">
						<div class="flex flex-col">
							<span class="text-2xl font-bold text-red-400">{socialPostsFailed}</span>
							<span class="mt-1 text-xs uppercase tracking-wider text-slate-400">Failed</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Quick Actions -->
		<div class="mt-6 flex flex-col gap-3 sm:flex-row">
			<button
				type="button"
				onclick={() => goto('/editor/new')}
				class="inline-flex items-center justify-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:opacity-60"
				disabled={!!$navigating}
			>
				{#if $navigating?.to?.url.pathname === '/editor/new'}Loading...{:else}+ New Post{/if}
			</button>
			<button
				type="button"
				onclick={goToPages}
				class="inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
			>
				Manage Pages
			</button>
		</div>

		<!-- Recent Posts -->
		<div class="mt-8">
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Recent Posts</h2>

			{#if recentPosts.length === 0}
				<div class="border border-slate-800 bg-slate-900/50 px-4 py-12 text-center text-sm text-slate-500">
					<p>No posts yet</p>
					<p class="mt-1 text-slate-600">Create your first post to get started</p>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					{#each recentPosts as post (post.id)}
						<div class="flex flex-col gap-3 border border-slate-800 bg-slate-900/50 p-4 transition hover:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0 flex-1">
								<h3 class="truncate text-sm font-medium text-white">{post.title || 'Untitled'}</h3>
								<div class="mt-1 flex items-center gap-3">
									<span
										class="inline-block px-2 py-0.5 text-xs font-medium {post.status === 'published'
											? 'bg-emerald-500/15 text-emerald-400'
											: 'bg-amber-500/15 text-amber-400'}"
									>
										{post.status}
									</span>
									<span class="text-xs text-slate-500">
										{new Date(post.updated_at).toLocaleDateString()}
									</span>
								</div>
							</div>
							<div class="flex shrink-0 gap-2">
								<button
									type="button"
									onclick={() => editPage(post.slug)}
									class="inline-flex items-center justify-center border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:text-accent-primary disabled:opacity-60"
									aria-label="Edit post"
									disabled={!!$navigating}
								>
									{#if $navigating?.to?.url.pathname === `/editor/${post.slug}`}<span class="animate-pulse text-accent-primary">...</span>{:else}Edit{/if}
								</button>
								{#if post.status === 'published'}
									<button
										type="button"
										onclick={() => viewPage(post.slug)}
										class="inline-flex items-center justify-center border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:text-accent-primary"
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

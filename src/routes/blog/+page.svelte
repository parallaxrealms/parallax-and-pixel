<script lang="ts">
	import type { Page } from '$lib';
	import { SEO } from '@parallaxrealms/components-core';
	import { Input } from '$lib/components/shadcn/ui/input';
	import { goto } from '$app/navigation';

	let { data } = $props();
	let posts = $derived(data.posts as Page[]);
	let recentPosts = $derived(data.recentPosts as Page[]);
	let categories = $derived(data.categories as string[]);
	let searchQuery = $state('');
	let categoryFilter = $derived(data.categoryFilter || '');

	// Sync searchQuery with data when navigating
	$effect(() => {
		searchQuery = data.searchQuery || '';
	});

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function getPostPreview(post: Page & { preview?: string }): string {
		return post.preview || post.meta_description || '';
	}

	function handleSearch(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams();
		if (searchQuery) params.set('q', searchQuery);
		if (categoryFilter) params.set('category', categoryFilter);
		goto(`/blog${params.toString() ? '?' + params.toString() : ''}`);
	}

	function handleCategoryClick(category: string) {
		const params = new URLSearchParams();
		if (searchQuery) params.set('q', searchQuery);
		if (category) params.set('category', category);
		goto(`/blog${params.toString() ? '?' + params.toString() : ''}`);
	}

	function clearFilters() {
		goto('/blog');
	}
</script>

<SEO
	title="Blog | Parallax&Pixel"
	description="Thoughts on web development, game design, and creative coding."
	siteName="Parallax&Pixel"
	siteUrl="https://www.parallaxandpixel.com"
	author="Parallax"
	ogImage="/preview/self_circle.webp"
/>

<div class="min-h-screen bg-slate-950">
	<!-- Header -->
	<header class="border-b border-slate-800 bg-slate-900/50 py-8">
		<div class="mx-auto max-w-6xl px-6">
			<h1 class="font-fade mb-2 text-3xl text-slate-100 md:text-4xl">
				<span class="text-accent-primary">Blog</span>
			</h1>
			<p class="text-base text-slate-400">
				Thoughts on web development, game design, and creative coding.
			</p>

			<!-- Search + Category Filter -->
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<form onsubmit={handleSearch} class="w-full max-w-xs">
					<Input
						type="search"
						placeholder="Search posts..."
						bind:value={searchQuery}
						class="font-terminal"
					/>
				</form>

				{#if categories.length > 0}
					<div class="flex flex-wrap items-center gap-2">
						<button
							onclick={() => handleCategoryClick('')}
							class="font-terminal px-3 py-1 text-xs transition-colors {!categoryFilter ? 'bg-accent-primary text-slate-950' : 'border border-slate-700 text-slate-400 hover:border-accent-primary hover:text-accent-primary'}"
						>
							All
						</button>
						{#each categories as category (category)}
							<button
								onclick={() => handleCategoryClick(category)}
								class="font-terminal px-3 py-1 text-xs transition-colors {categoryFilter === category ? 'bg-accent-primary text-slate-950' : 'border border-slate-700 text-slate-400 hover:border-accent-primary hover:text-accent-primary'}"
							>
								{category}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if searchQuery || categoryFilter}
				<button
					onclick={clearFilters}
					class="font-terminal mt-2 text-xs text-slate-500 hover:text-accent-primary"
				>
					Clear filters
				</button>
			{/if}
		</div>
	</header>

	<!-- Main Content with Sidebar -->
	<div class="mx-auto max-w-6xl px-6 py-12">
		<div class="grid gap-8 lg:grid-cols-[1fr_280px]">
			<!-- Posts List -->
			<main>
				{#if posts.length === 0}
					<div class="py-20 text-center">
						<p class="font-terminal text-lg text-slate-400">
							{#if searchQuery || categoryFilter}
								No posts found matching your filters
							{:else}
								No blog posts yet. Check back soon!
							{/if}
						</p>
					</div>
				{:else}
					<div class="space-y-8">
						{#each posts as post (post.id)}
							<article class="group">
								<a
									href="/blog/{post.slug}"
									class="block border border-slate-800 bg-slate-900 p-6 transition-all hover:border-accent-primary hover:shadow-lg hover:shadow-accent-primary/10"
								>
									<div class="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
										{#if post.banner_image_url}
											<div class="md:w-48 md:flex-shrink-0">
												<img
													src={post.banner_image_url}
													alt={post.title}
													loading="lazy"
													width="192"
													height="128"
													class="h-32 w-full object-cover md:h-24"
												/>
											</div>
										{/if}

										<div class="flex-1">
											<div class="mb-2 flex items-center gap-2">
												<h2 class="text-xl font-bold text-slate-100 transition-colors group-hover:text-accent-primary">
													{post.title}
												</h2>
												{#if post.category}
													<span class="font-terminal bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
														{post.category}
													</span>
												{/if}
											</div>

											{#if getPostPreview(post)}
												<p class="mb-3 line-clamp-2 text-sm text-slate-400">
													{getPostPreview(post)}
												</p>
											{/if}

											<div class="flex items-center gap-4 text-sm text-slate-500">
												<span class="font-terminal">
													{formatDate(post.created_at)}
												</span>
												<span class="font-terminal text-accent-primary opacity-0 transition-opacity group-hover:opacity-100">
													Read more &rarr;
												</span>
											</div>
										</div>
									</div>
								</a>
							</article>
						{/each}
					</div>
				{/if}
			</main>

			<!-- Sidebar: Most Recent -->
			<aside class="hidden lg:block">
				<div class="sticky top-8 border border-slate-800 bg-slate-900/50 p-6">
					<h2 class="font-terminal mb-4 text-sm font-semibold text-accent-primary">
						Most Recent
					</h2>

					{#if recentPosts.length > 0}
						<div class="space-y-3">
							{#each recentPosts as post (post.id)}
								<a
									href="/blog/{post.slug}"
									class="group block border-b border-slate-800 pb-3 last:border-0 last:pb-0"
								>
									<h3
										class="font-terminal text-sm font-medium text-slate-200 transition-colors group-hover:text-accent-primary"
									>
										{post.title}
									</h3>
									<span class="font-terminal text-xs text-slate-500">
										{formatDate(post.created_at)}
									</span>
								</a>
							{/each}
						</div>
					{:else}
						<p class="font-terminal text-sm text-slate-500">
							No posts yet.
						</p>
					{/if}
				</div>
			</aside>
		</div>
	</div>
</div>

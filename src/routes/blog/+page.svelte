<script lang="ts">
	import type { Page } from '$lib';
	import { SEO } from '@parallaxrealms/components-core';
	import { Input } from '$lib/components/shadcn/ui/input';
	// No icons - text-only design
	import { goto } from '$app/navigation';

	let { data } = $props();
	let posts = $derived(data.posts as Page[]);
	let searchQuery = $state(data.searchQuery || '');

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function handleSearch(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams();
		if (searchQuery) params.set('q', searchQuery);
		goto(`/blog${params.toString() ? '?' + params.toString() : ''}`);
	}
</script>

<SEO title="Blog | Parallax&Pixel" description="Thoughts on web development, game design, and creative coding." />

<div class="min-h-screen bg-slate-950">
	<!-- Header -->
	<header class="border-b border-slate-800 bg-slate-900/50 py-8">
		<div class="mx-auto max-w-4xl px-6">
			<h1 class="font-fade mb-2 text-3xl text-slate-100 md:text-4xl">
				<span class="text-accent-primary">Blog</span>
			</h1>
			<p class="font-terminal text-base text-slate-400">
				Thoughts on web development, game design, and creative coding.
			</p>

			<!-- Search -->
			<form onsubmit={handleSearch} class="mt-4 max-w-md">
				<Input
					type="search"
					placeholder="Search posts..."
					bind:value={searchQuery}
					class="font-terminal"
				/>
			</form>
		</div>
	</header>

	<!-- Posts Grid -->
	<main class="mx-auto max-w-4xl px-6 py-12">
		{#if posts.length === 0}
			<div class="py-20 text-center">
				<p class="font-terminal text-lg text-slate-400">
					{#if searchQuery}
						No posts found matching "{searchQuery}"
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
											class="h-32 w-full object-cover md:h-24"
										/>
									</div>
								{/if}

								<div class="flex-1">
									<h2 class="font-terminal mb-2 text-xl font-semibold text-slate-100 transition-colors group-hover:text-accent-primary">
										{post.title}
									</h2>

									{#if post.meta_description}
										<p class="mb-3 line-clamp-2 text-slate-400">
											{post.meta_description}
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
</div>

<script lang="ts">
	import type { Page } from '$lib';
	import { SEO } from '@parallaxrealms/components-core';
	import { EdraEditor, sanitizeEditorContent } from '@parallaxrealms/components-edda';
	// No icons - text-only design

	let { data } = $props();
	let post = $derived(data.post as Page);
	let relatedPosts = $derived(data.relatedPosts as Page[]);

	// Sanitize content to remove placeholder nodes
	let sanitizedContent = $derived(sanitizeEditorContent(post.content));

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<SEO
	title="{post.title} | Blog | Parallax & Pixel"
	description={post.meta_description ?? undefined}
/>

<div class="min-h-screen bg-slate-950">
	<!-- Back link -->
	<div class="border-b border-slate-800 bg-slate-900/50">
		<div class="mx-auto max-w-4xl px-6 py-4">
			<a
				href="/blog"
				class="font-terminal text-sm text-slate-400 transition-colors hover:text-accent-primary"
			>
				&larr; Back to Blog
			</a>
		</div>
	</div>

	<!-- Article -->
	<article class="mx-auto max-w-4xl px-6 py-12">
		<!-- Header -->
		<header class="mb-8">
			<h1 class="font-terminal mb-4 text-3xl font-bold text-slate-100 md:text-4xl">
				{post.title}
			</h1>

			<div class="flex items-center gap-4 font-terminal text-sm text-slate-500">
				<span>
					{formatDate(post.created_at)}
				</span>
				{#if post.updated_at && post.updated_at !== post.created_at}
					<span class="text-slate-600">|</span>
					<span>Updated {formatDate(post.updated_at)}</span>
				{/if}
			</div>
		</header>

		<!-- Banner Image -->
		{#if post.banner_image_url}
			<figure class="mb-8">
				<img
					src={post.banner_image_url}
					alt={post.title}
					class="w-full object-cover shadow-lg"
				/>
			</figure>
		{/if}

		<!-- Content -->
		{#if sanitizedContent}
			<div class="prose prose-lg prose-invert max-w-none">
				<EdraEditor content={sanitizedContent} editable={false} />
			</div>
		{/if}
	</article>

	<!-- Related Posts -->
	{#if relatedPosts.length > 0}
		<aside class="border-t border-slate-800 bg-slate-900/50 py-12">
			<div class="mx-auto max-w-4xl px-6">
				<h2 class="font-terminal mb-6 text-xl font-semibold text-slate-100">
					More Posts
				</h2>

				<div class="grid gap-6 md:grid-cols-3">
					{#each relatedPosts as related (related.id)}
						<a
							href="/blog/{related.slug}"
							class="group block border border-slate-800 bg-slate-900 p-4 transition-all hover:border-accent-primary hover:shadow-lg"
						>
							{#if related.banner_image_url}
								<img
									src={related.banner_image_url}
									alt={related.title}
									class="mb-3 h-24 w-full object-cover"
								/>
							{/if}
							<h3 class="font-terminal mb-1 text-sm font-semibold text-slate-100 transition-colors group-hover:text-accent-primary">
								{related.title}
							</h3>
							<p class="text-xs text-slate-500">
								{formatDate(related.created_at)}
							</p>
						</a>
					{/each}
				</div>
			</div>
		</aside>
	{/if}
</div>

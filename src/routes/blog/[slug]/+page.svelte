<script lang="ts">
	import type { Page } from '$lib';
	import { SEO } from '@parallaxrealms/components-core';
	import JsonLd from '$lib/components/custom/seo/JsonLd.svelte';
	import {
		EdraEditor,
		sanitizeEditorContent,
	} from '@parallaxrealms/components-edda';
	import {
		ImageComparisonSliderNode,
		ThumbnailGalleryNode,
		YouTubeEmbedNode,
		ImageOnlySliderNode,
		MultiColumnNode,
		ColumnNode
	} from '$lib/editor/extensions';
	import ImageLightbox from '$lib/components/custom/media/ImageLightbox.svelte';

	const customExtensions = [
		ImageComparisonSliderNode,
		ThumbnailGalleryNode,
		YouTubeEmbedNode,
		ImageOnlySliderNode,
		MultiColumnNode,
		ColumnNode
	];

	let { data } = $props();
	let post = $derived(data.post as Page);
	let relatedPosts = $derived(data.relatedPosts as Page[]);

	// Lightbox state
	let proseEl: HTMLDivElement | undefined = $state();
	let lightboxImages: { url: string; alt?: string; caption?: string }[] = $state([]);
	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);

	// Collect eligible images from rendered prose content
	$effect(() => {
		if (!proseEl) return;

		// Small delay to let EdraEditor render
		const timer = setTimeout(() => {
			const imgs = Array.from(proseEl!.querySelectorAll('img')).filter((img) => {
				// Exclude images inside comparison sliders and image sliders
				return !img.closest('[data-type="image-comparison-slider"]') &&
					!img.closest('[data-type="image-only-slider"]');
			});

			lightboxImages = imgs.map((img) => ({
				url: img.src,
				alt: img.alt || undefined
			}));
		}, 100);

		return () => clearTimeout(timer);
	});

	function handleProseClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName !== 'IMG') return;

		// Exclude images inside excluded node types
		if (target.closest('[data-type="image-comparison-slider"]') ||
			target.closest('[data-type="image-only-slider"]')) return;

		const imgEl = target as HTMLImageElement;
		const idx = lightboxImages.findIndex((img) => img.url === imgEl.src);
		if (idx >= 0) {
			lightboxIndex = idx;
			lightboxOpen = true;
		}
	}

	// Get scrolling text from page_options
	let scrollingText = $derived(
		(post.page_options as Record<string, unknown>)?.scrollingText as
			| string
			| undefined,
	);

	// Get default text color from page_options
	let textColorLight = $derived(
		(post.page_options as Record<string, unknown>)?.textColorLight as string | undefined
	);
	let textColorDark = $derived(
		(post.page_options as Record<string, unknown>)?.textColorDark as string | undefined
	);
	// PxP blog is always dark mode
	let defaultTextColorStyle = $derived(
		textColorDark ? `color: ${textColorDark}` : ''
	);

	// Sanitize content to remove placeholder nodes
	let sanitizedContent = $derived(sanitizeEditorContent(post.content));

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	}

	// Structured data for this post
	const SITE_URL = 'https://www.parallaxandpixel.com';
	let postUrl = $derived(`${SITE_URL}/blog/${post.slug}`);
	let postImage = $derived(
		post.banner_image_url
			? post.banner_image_url.startsWith('http')
				? post.banner_image_url
				: `${SITE_URL}${post.banner_image_url}`
			: undefined
	);
	let blogPostingSchema = $derived({
		'@type': 'BlogPosting',
		headline: post.title,
		datePublished: post.created_at,
		dateModified: post.updated_at || post.created_at,
		url: postUrl,
		mainEntityOfPage: postUrl,
		...(post.meta_description ? { description: post.meta_description } : {}),
		...(postImage ? { image: postImage } : {}),
		author: {
			'@type': 'Person',
			name: 'Parallax',
			url: SITE_URL
		}
	});
	let breadcrumbSchema = $derived({
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
			{ '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
			{ '@type': 'ListItem', position: 3, name: post.title, item: postUrl }
		]
	});
</script>

<SEO
	title="{post.title} | Blog | Parallax&Pixel"
	description={post.meta_description ?? undefined}
	siteName="Parallax&Pixel"
	siteUrl="https://www.parallaxandpixel.com"
	author="Parallax"
	ogImage={post.banner_image_url ?? '/preview/self_circle.webp'}
/>

<JsonLd data={blogPostingSchema} />
<JsonLd data={breadcrumbSchema} />

<div class="min-h-screen bg-slate-950">
	<!-- Article -->
	<article class="mx-auto max-w-4xl px-6 py-12">
		<!-- Header -->
		<header class="mb-8 text-center">
			<!-- Author row with back link -->
			<div class="mb-6 flex items-center justify-center gap-4">
				<a
					href="/blog"
					class="font-terminal text-sm text-slate-400 transition-colors hover:text-accent-primary"
				>
					&larr; Back to Blog
				</a>
				<span class="text-slate-600">•</span>
				<img
					src="/preview/self_circle.webp"
					alt="Parallax"
					width="64"
					height="64"
					class="h-16 w-16 rounded-full object-cover"
				/>
				<div class="text-left">
					<p class="font-terminal text-sm text-slate-400">Written by</p>
					<p class="font-terminal text-slate-200">Parallax</p>
				</div>
				<span class="text-slate-600">•</span>
				<span class="font-terminal text-sm text-slate-500">
					{formatDate(post.created_at)}
				</span>
			</div>

			<!-- Scrolling ticker (if post has scrolling_text) -->
			{#if scrollingText}
				<div
					class="ticker-container mb-6 overflow-hidden border-y border-slate-800 py-3"
				>
					<span class="ticker-text font-terminal text-sm text-slate-400">
						{scrollingText}
					</span>
				</div>
			{/if}

			<!-- Title -->
			<h1
				class="mb-4 text-3xl font-bold text-slate-300 md:text-4xl"
			>
				{post.title}
			</h1>

			{#if post.updated_at && post.updated_at !== post.created_at}
				<p class="font-terminal text-xs text-slate-500">
					Updated {formatDate(post.updated_at)}
				</p>
			{/if}
		</header>

		<!-- Banner Image -->
		{#if post.banner_image_url}
			<figure class="mb-8">
				<img
					src={post.banner_image_url}
					alt={post.title}
					width="896"
					height="400"
					fetchpriority="high"
					class="w-full object-cover shadow-lg"
				/>
			</figure>
		{/if}

		<!-- Content -->
		{#if sanitizedContent}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="prose prose-lg prose-invert lightbox-prose max-w-none"
				bind:this={proseEl}
				onclick={handleProseClick}
				style={defaultTextColorStyle}
			>
				<EdraEditor content={sanitizedContent} editable={false} {customExtensions} />
			</div>
		{/if}
	</article>

	<ImageLightbox images={lightboxImages} initialIndex={lightboxIndex} bind:open={lightboxOpen} />

	<!-- Related Posts -->
	{#if relatedPosts.length > 0}
		<aside class="border-t border-slate-800 bg-slate-900/50 py-12">
			<div class="mx-auto max-w-4xl px-6">
				<h2 class="mb-6 text-xl font-bold text-slate-100">
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
									loading="lazy"
									width="300"
									height="96"
									class="mb-3 h-24 w-full object-cover"
								/>
							{/if}
							<h3
								class="font-terminal mb-1 text-sm font-semibold text-slate-100 transition-colors group-hover:text-accent-primary"
							>
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

<style>
	.ticker-container {
		width: 100%;
	}

	.ticker-text {
		display: inline-block;
		white-space: pre;
		padding-left: 100%;
		animation: scroll-left 25s linear infinite;
	}

	@keyframes scroll-left {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-100%);
		}
	}

	/* Hide editor bubble menus (table row/col controls, link menu) on public blog page */
	.lightbox-prose :global(.bubble-menu-wrapper) {
		display: none !important;
	}

	/* Lightbox-eligible images get cursor pointer and hover effect */
	.lightbox-prose :global(img) {
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.lightbox-prose :global(img:hover) {
		opacity: 0.85;
	}

	/* Exclude images inside custom node views from lightbox styling */
	.lightbox-prose :global([data-type="image-comparison-slider"] img),
	.lightbox-prose :global([data-type="image-only-slider"] img) {
		cursor: default;
	}

	.lightbox-prose :global([data-type="image-comparison-slider"] img:hover),
	.lightbox-prose :global([data-type="image-only-slider"] img:hover) {
		opacity: 1;
	}
</style>

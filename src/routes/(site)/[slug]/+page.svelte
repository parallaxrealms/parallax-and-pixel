<script lang="ts">
	import type { Page } from '$lib';
	import { SEO } from '@parallaxrealms/components-core';
	import { EdraEditor, sanitizeEditorContent } from '@parallaxrealms/components-edda';
	import { mode } from 'mode-watcher';
	import Nav from '$lib/components/custom/nav/Nav.svelte';
	import Footer from '$lib/components/snippets/Footer.svelte';

	let { data } = $props();
	let supabase = $derived(data.supabase);
	let page = $derived(data.page as Page);

	// Sanitize content to remove placeholder nodes (image-placeholder, etc.)
	let sanitizedContent = $derived(sanitizeEditorContent(page.content));

	// Extract page options
	let pageOpts = $derived((page.page_options ?? {}) as Record<string, unknown>);

	// Extract background options from page_options
	interface BackgroundOptions {
		type: 'none' | 'color' | 'gradient' | 'image';
		// Solid color light/dark
		colorLight?: string;
		colorDark?: string;
		// Gradient colors
		gradientColor1Light?: string;
		gradientColor1Dark?: string;
		gradientColor2Light?: string;
		gradientColor2Dark?: string;
		gradientDirection?: string;
		// Image options
		imageUrl?: string;
		size?: 'cover' | 'contain' | 'auto';
		position?: string;
		repeat?: string;
		// Overlay
		overlayEnabled?: boolean;
		overlayColorLight?: string;
		overlayColorDark?: string;
		overlayAlpha?: number;
	}

	let bgOptions = $derived.by<BackgroundOptions | null>(() => {
		if (pageOpts?.background) {
			return pageOpts.background as BackgroundOptions;
		}
		return null;
	});

	// Check if we're in dark mode
	let isDark = $derived(mode.current === 'dark');

	// Generate background styles based on current mode
	let backgroundStyles = $derived.by(() => {
		const opts = bgOptions;
		if (!opts || opts.type === 'none') return '';

		const styles: string[] = [];

		if (opts.type === 'color') {
			const color = isDark ? opts.colorDark : opts.colorLight;
			if (color) styles.push(`background-color: ${color}`);
		} else if (opts.type === 'gradient') {
			const c1 = isDark ? opts.gradientColor1Dark : opts.gradientColor1Light;
			const c2 = isDark ? opts.gradientColor2Dark : opts.gradientColor2Light;
			const dir = opts.gradientDirection || 'to bottom';
			if (c1 && c2) styles.push(`background: linear-gradient(${dir}, ${c1}, ${c2})`);
		} else if (opts.type === 'image' && opts.imageUrl) {
			styles.push(`background-image: url('${opts.imageUrl}')`);
			styles.push(`background-size: ${opts.size || 'cover'}`);
			styles.push(`background-position: ${opts.position || 'center center'}`);
			styles.push(`background-repeat: ${opts.repeat || 'no-repeat'}`);
			styles.push('background-attachment: fixed');
		}

		return styles.join('; ');
	});

	// Generate overlay styles based on current mode
	let overlayStyles = $derived.by(() => {
		const opts = bgOptions;
		if (!opts || opts.type !== 'image' || !opts.overlayEnabled) return '';

		const color = isDark ? (opts.overlayColorDark || '#000000') : (opts.overlayColorLight || '#000000');
		const alpha = opts.overlayAlpha ?? 0.5;

		// Convert hex to rgba
		const r = parseInt(color.slice(1, 3), 16);
		const g = parseInt(color.slice(3, 5), 16);
		const b = parseInt(color.slice(5, 7), 16);

		return `background-color: rgba(${r}, ${g}, ${b}, ${alpha})`;
	});

	// Text color based on mode
	let textColorStyle = $derived.by(() => {
		const color = isDark ? (pageOpts?.textColorDark as string) : (pageOpts?.textColorLight as string);
		return color ? `color: ${color}` : '';
	});

	let hasBackground = $derived.by(() => {
		const opts = bgOptions;
		return opts && opts.type !== 'none';
	});

	let hasOverlay = $derived.by(() => {
		const opts = bgOptions;
		return opts?.type === 'image' && opts.overlayEnabled;
	});
</script>

<SEO
	title="{page.title} | Parallax&Pixel"
	description={page.meta_description ?? undefined}
	siteName="Parallax&Pixel"
	siteUrl="https://www.parallaxandpixel.com"
	author="Parallax"
	ogImage={page.banner_image_url ?? '/preview/self_circle.webp'}
/>

<Nav {supabase} {data} variant="site" navbarLinks={data.navbarLinks} />

<div class="page-wrapper" class:has-background={hasBackground} style="{backgroundStyles}; {textColorStyle}">
	{#if hasOverlay}
		<div class="page-overlay" style={overlayStyles}></div>
	{/if}

	<article class="page-content">
		{#if page.banner_image_url}
			<img src={page.banner_image_url} alt={page.title} width="896" height="400" class="banner-image" />
		{/if}

		<h1>{page.title}</h1>

		{#if sanitizedContent}
			<div class="prose prose-lg dark:prose-invert max-w-none">
				<EdraEditor content={sanitizedContent} editable={false} />
			</div>
		{/if}
	</article>
</div>

<Footer />

<style>
	.page-wrapper {
		min-height: 100vh;
		position: relative;
	}

	.page-wrapper.has-background {
		min-height: 100vh;
	}

	.page-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 0;
	}

	.page-content {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem 1rem;
		position: relative;
		z-index: 1;
	}

	.banner-image {
		width: 100%;
		height: auto;
		border-radius: 0.5rem;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
		color: inherit;
	}

	/* Hide editor bubble menus (table row/col controls, link menu) on public pages */
	.page-content :global(.bubble-menu-wrapper) {
		display: none !important;
	}
</style>

<script lang="ts">
	import { SEO } from '@parallaxrealms/components-core';
	import JsonLd from '$lib/components/custom/seo/JsonLd.svelte';
	import { getAllProjects } from '$lib/data/projects';
	import ProjectShowcaseRow from '$lib/components/custom/ProjectShowcaseRow.svelte';

	const projects = getAllProjects('web');

	const SITE_URL = 'https://www.parallaxandpixel.com';
	const collectionSchema = {
		'@type': 'CollectionPage',
		name: 'Web Projects | Parallax&Pixel',
		url: `${SITE_URL}/web`,
		mainEntity: {
			'@type': 'ItemList',
			itemListElement: projects.map((project, i) => ({
				'@type': 'ListItem',
				position: i + 1,
				name: project.title,
				url: project.liveUrl ?? `${SITE_URL}/web`
			}))
		}
	};
</script>

<SEO
	title="Web Projects | Parallax&Pixel"
	description="Web development projects showcasing full-stack applications, APIs, and interactive experiences."
	siteName="Parallax&Pixel"
	siteUrl="https://www.parallaxandpixel.com"
	author="Parallax"
	ogImage="/preview/self_circle.webp"
/>

<JsonLd data={collectionSchema} />

<div class="min-h-screen bg-slate-950">
	<!-- Header -->
	<header class="relative overflow-hidden border-b border-slate-800 bg-slate-950">
		<div class="header-glow pointer-events-none absolute inset-0" aria-hidden="true"></div>
		<div class="relative px-6 py-16 sm:px-10 lg:px-14 lg:py-24 xl:px-20">
			<a
				href="/"
				class="font-terminal mb-10 inline-block text-sm text-slate-500 transition-colors hover:text-accent-primary"
			>
				../ back to home
			</a>

			<p class="font-terminal mb-4 text-xs tracking-[0.35em] text-accent-primary uppercase">
				portfolio // web index
			</p>

			<h1 class="font-display mb-6 text-5xl leading-tight text-slate-100 md:text-7xl">
				Web <span class="text-accent-primary">Projects</span>
			</h1>

			<p class="max-w-2xl text-lg leading-relaxed text-slate-400">
				Full-stack web applications, custom e-commerce platforms, APIs, and
				interactive experiences. Built with modern frameworks and best
				practices.
			</p>

			<p class="font-terminal mt-10 text-xs tracking-[0.25em] text-slate-600 uppercase">
				{projects.length} projects indexed
			</p>
		</div>
	</header>

	<!-- Project Showcase Rows -->
	<main>
		{#if projects.length === 0}
			<div class="py-24 text-center">
				<p class="font-terminal text-lg text-slate-400">
					Projects coming soon!
				</p>
			</div>
		{:else}
			{#each projects as project, i (project.id)}
				<ProjectShowcaseRow {project} index={i} accent="primary" />
			{/each}

			<div class="px-6 py-12 text-center">
				<span class="font-terminal text-xs tracking-[0.35em] text-slate-600 uppercase">
					// end of index
				</span>
			</div>
		{/if}
	</main>
</div>

<style>
	.header-glow {
		background:
			radial-gradient(ellipse 80% 60% at 15% 0%, rgba(0, 165, 207, 0.12), transparent 60%),
			radial-gradient(ellipse 60% 50% at 90% 100%, rgba(37, 161, 142, 0.07), transparent 60%);
	}
</style>

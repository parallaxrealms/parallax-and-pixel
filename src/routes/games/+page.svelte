<script lang="ts">
	import { SEO } from '@parallaxrealms/pxp-components';
	import JsonLd from '$lib/components/custom/seo/JsonLd.svelte';
	import { getAllProjects } from '$lib/data/projects';
	import ProjectShowcaseRow from '$lib/components/custom/ProjectShowcaseRow.svelte';

	const projects = getAllProjects('game');

	const SITE_URL = 'https://www.parallaxandpixel.com';
	const collectionSchema = {
		'@type': 'CollectionPage',
		name: 'Game Projects | Parallax&Pixel',
		url: `${SITE_URL}/games`,
		mainEntity: {
			'@type': 'ItemList',
			itemListElement: projects.map((project, i) => ({
				'@type': 'ListItem',
				position: i + 1,
				name: project.title,
				url:
					project.liveUrl ??
					(project.devlogUrl
						? project.devlogUrl.startsWith('http')
							? project.devlogUrl
							: `${SITE_URL}${project.devlogUrl}`
						: `${SITE_URL}/games`)
			}))
		}
	};
</script>

<SEO
	title="Game Projects | Parallax&Pixel"
	description="Game development projects featuring indie games, prototypes, and interactive experiences."
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
		<div class="relative px-5 py-5 sm:px-8 lg:px-10 lg:py-6">
			<a
				href="/"
				class="font-terminal mb-3 inline-block text-sm text-slate-500 transition-colors hover:text-accent-highlight"
			>
				../ back to home
			</a>

			<p class="font-terminal mb-1.5 text-xs tracking-[0.35em] text-accent-highlight uppercase">
				portfolio // game index
			</p>

			<h1 class="mb-2 text-4xl leading-tight font-bold text-slate-100 md:text-5xl">
				Game <span class="text-accent-highlight">Projects</span>
			</h1>

			<div class="space-y-2">
				<p class="text-lg leading-relaxed text-slate-400">
					These are the games I'm most proud of that I've made in the past 5
					years. I've been diving into game development and design on and off
					for the past 15 years, both digital and tabletop.
				</p>
				<p class="text-base leading-relaxed text-slate-500">
					I started making flash games way back in the early 2000s and around
					the same time began getting heavily into Dungeons & Dragons and other
					TTRPG games. After that I spent time with the Unity Engine joining
					the occasional game jam but never quite able to commit fully to my
					passion project. These days I'm full-time with Godot and make assets
					primarily with Blender, Photoshop and Aseprite.
				</p>
			</div>

			<p class="font-terminal mt-3 text-xs tracking-[0.25em] text-slate-600 uppercase">
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
				<ProjectShowcaseRow {project} index={i} accent="highlight" />
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
			radial-gradient(ellipse 80% 60% at 15% 0%, rgba(159, 255, 203, 0.09), transparent 60%),
			radial-gradient(ellipse 60% 50% at 90% 100%, rgba(37, 161, 142, 0.08), transparent 60%);
	}
</style>

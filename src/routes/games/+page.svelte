<script lang="ts">
	import { SEO } from '@parallaxrealms/components-core';
	import { getAllProjects } from '$lib/data/projects';
	import ProjectCard from '$lib/components/custom/ProjectCard.svelte';

	const projects = getAllProjects('game');
</script>

<SEO
	title="Game Projects | Parallax&Pixel"
	description="Game development projects featuring indie games, prototypes, and interactive experiences."
	siteName="Parallax&Pixel"
	siteUrl="https://www.parallaxandpixel.com"
	author="Parallax"
	ogImage="/preview/self_circle.webp"
/>

<div class="min-h-screen bg-slate-950">
	<!-- Header -->
	<header class="border-b border-slate-800 bg-slate-900/50 py-8">
		<div class="mx-auto max-w-7xl px-6">
			<a
				href="/"
				class="mb-3 inline-block font-terminal text-sm text-slate-400 transition-colors hover:text-accent-highlight"
			>
				Back to Home
			</a>

			<h1 class="font-fade mb-2 text-3xl text-slate-100 md:text-4xl">
				<span class="text-accent-highlight">Game</span> Projects
			</h1>
			<p
				class="font-terminal max-w-6xl text-lg text-slate-400 pb-1 leading-relaxed"
			>
				These are the games I'm most proud of that I've made in the past 5
				years. I've been diving into game development and design on and off for
				the past 15 years, both digital and tabletop.
			</p>
			<p
				class="font-terminal max-w-6xl text-base text-slate-400 pt-1 leading-relaxed"
			>
				I started making flash games way back in the early 2000s and around the
				same time began getting heavily into Dungeons & Dragons and other TTRPG
				games. After that I spent time with the Unity Engine joining the
				occasional game jam but never quite able to commit fully to my passion
				project. These days I'm full-time with Godot and make assets primarily
				with Blender, Photoshop and Aseprite.
			</p>
		</div>
	</header>

	<!-- Projects Grid -->
	<main class="mx-auto max-w-6xl px-6 py-12">
		{#if projects.length === 0}
			<div class="py-20 text-center">
				<p class="font-terminal text-lg text-slate-400">
					Projects coming soon!
				</p>
			</div>
		{:else}
			<div class="grid gap-8 md:grid-cols-2">
				{#each projects as project (project.id)}
					<ProjectCard {project} hideViewDetails={true} />
				{/each}
			</div>
		{/if}
	</main>
</div>

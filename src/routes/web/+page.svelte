<script lang="ts">
	import { SEO } from '@parallaxrealms/components-core';
	import { getAllProjects } from '$lib/data/projects';
	import ProjectCard from '$lib/components/custom/ProjectCard.svelte';

	const projects = getAllProjects('web');
</script>

<SEO
	title="Web Projects | Parallax&Pixel"
	description="Web development projects showcasing full-stack applications, APIs, and interactive experiences."
/>

<div class="min-h-screen bg-slate-950">
	<!-- Header -->
	<header class="border-b border-slate-800 bg-slate-900/50 py-8">
		<div class="mx-auto max-w-6xl px-6">
			<a
				href="/"
				class="mb-3 inline-block font-terminal text-sm text-slate-400 transition-colors hover:text-accent-primary"
			>
				&larr; Back to Home
			</a>

			<h1 class="font-fade mb-2 text-3xl text-slate-100 md:text-4xl">
				<span class="text-accent-primary">Web</span> Projects
			</h1>
			<p class="font-terminal max-w-2xl text-base text-slate-400">
				Full-stack web applications, APIs, and interactive experiences. Built with modern frameworks and best practices.
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
					<ProjectCard {project} />
				{/each}
			</div>
		{/if}
	</main>
</div>

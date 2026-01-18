<script lang="ts">
	import type { Project } from '$lib/data/projects';

	interface Props {
		project: Project;
		variant?: 'default' | 'compact';
	}

	let { project, variant = 'default' }: Props = $props();
</script>

<article
	class="group relative overflow-hidden border border-slate-800 bg-slate-900 transition-all hover:border-accent-primary hover:shadow-lg hover:shadow-accent-primary/10"
>
	<!-- Project Image -->
	<div class="relative aspect-video overflow-hidden bg-slate-800">
		{#if project.image}
			<img
				src={project.image}
				alt={project.title}
				class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
				onerror={(e) => {
					const target = e.target as HTMLImageElement;
					target.style.display = 'none';
				}}
			/>
		{/if}
		<!-- Placeholder if no image -->
		<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent-primary/20 via-accent-highlight/20 to-accent-secondary/20">
			<span class="font-rubik text-2xl text-slate-600">
				{project.category === 'game' ? 'GAME' : 'WEB'}
			</span>
		</div>

		<!-- Overlay with links -->
		<div class="absolute inset-0 flex items-center justify-center gap-3 bg-slate-900/80 opacity-0 transition-opacity group-hover:opacity-100">
			{#if project.liveUrl}
				<a
					href={project.liveUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="font-terminal bg-accent-primary px-4 py-2 text-sm text-slate-900 transition-transform hover:scale-105"
				>
					View
				</a>
			{/if}
			{#if project.repoUrl}
				<a
					href={project.repoUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="font-terminal bg-slate-100 px-4 py-2 text-sm text-slate-900 transition-transform hover:scale-105"
				>
					Code
				</a>
			{/if}
		</div>
	</div>

	<!-- Content -->
	<div class="p-5">
		<h3 class="font-terminal mb-2 text-lg font-semibold text-slate-100">
			{project.title}
		</h3>

		{#if variant === 'default'}
			<p class="mb-4 line-clamp-2 text-sm text-slate-400">
				{project.description}
			</p>
		{/if}

		<!-- Tech Stack -->
		<div class="flex flex-wrap gap-1.5">
			{#each project.techStack.slice(0, variant === 'compact' ? 3 : 5) as tech (tech)}
				<span class="bg-slate-800 px-2 py-0.5 font-terminal text-xs text-slate-400">
					{tech}
				</span>
			{/each}
			{#if project.techStack.length > (variant === 'compact' ? 3 : 5)}
				<span class="bg-slate-800 px-2 py-0.5 font-terminal text-xs text-slate-500">
					+{project.techStack.length - (variant === 'compact' ? 3 : 5)}
				</span>
			{/if}
		</div>
	</div>
</article>

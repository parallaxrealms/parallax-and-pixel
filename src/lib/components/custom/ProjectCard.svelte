<script lang="ts">
	import type { Project } from '$lib/data/projects';

	interface Props {
		project: Project;
		variant?: 'default' | 'compact';
		hideViewDetails?: boolean;
	}

	let { project, variant = 'default', hideViewDetails = false }: Props = $props();
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
				loading="lazy"
				width="640"
				height="360"
				class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
				onerror={(e) => {
					const target = e.target as HTMLImageElement;
					target.style.display = 'none';
				}}
			/>
		{/if}
		<!-- Overlay with links -->
		<div class="absolute inset-0 flex items-end justify-center gap-3 pb-4 opacity-0 transition-opacity group-hover:opacity-100">
			{#if project.category === 'game'}
				<!-- Game cards: View Details + Play -->
				{#if !hideViewDetails}
					<a
						href="/games"
						class="bg-slate-100 px-4 py-2 text-sm text-slate-900 transition-transform hover:scale-105"
					>
						View Details
					</a>
				{/if}
				{#if project.liveUrl}
					<a
						href={project.liveUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="bg-accent-primary px-4 py-2 text-sm text-slate-900 transition-transform hover:scale-105"
					>
						Play
					</a>
				{/if}
			{:else}
				<!-- Web cards: View + Code -->
				{#if project.liveUrl}
					<a
						href={project.liveUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="bg-accent-primary px-4 py-2 text-sm text-slate-900 transition-transform hover:scale-105"
					>
						View
					</a>
				{/if}
				{#if project.repoUrl}
					<a
						href={project.repoUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="bg-slate-100 px-4 py-2 text-sm text-slate-900 transition-transform hover:scale-105"
					>
						Code
					</a>
				{/if}
			{/if}
			{#if project.devlogUrl}
				<a
					href={project.devlogUrl}
					class="bg-accent-secondary px-4 py-2 text-sm text-slate-900 transition-transform hover:scale-105"
				>
					Devlog
				</a>
			{/if}
		</div>
	</div>

	<!-- Content -->
	<div class="p-5">
		<h3 class="mb-2 text-xl font-bold text-slate-100">
			{project.title}
		</h3>

		<p class="mb-4 text-slate-300 {variant === 'compact' ? 'line-clamp-2 text-sm' : 'text-base'}">
			{project.description}
		</p>

		<!-- Tech Stack -->
		<div class="flex flex-wrap gap-1.5">
			{#each project.techStack.slice(0, variant === 'compact' ? 3 : 5) as tech (tech)}
				<span class="bg-slate-800 px-2 py-1 text-sm text-slate-300">
					{tech}
				</span>
			{/each}
			{#if project.techStack.length > (variant === 'compact' ? 3 : 5)}
				<span class="bg-slate-800 px-2 py-1 text-sm text-slate-400">
					+{project.techStack.length - (variant === 'compact' ? 3 : 5)}
				</span>
			{/if}
		</div>
	</div>
</article>

<script lang="ts">
	import type { Project } from '$lib/data/projects';

	interface Props {
		project: Project;
		index: number;
		accent?: 'primary' | 'highlight';
	}

	let { project, index, accent = 'primary' }: Props = $props();

	const accents = {
		primary: {
			color: '#00a5cf',
			glow: 'rgba(0, 165, 207, 0.4)',
			soft: 'rgba(0, 165, 207, 0.07)'
		},
		highlight: {
			color: '#9fffcb',
			glow: 'rgba(159, 255, 203, 0.35)',
			soft: 'rgba(159, 255, 203, 0.06)'
		}
	} as const;

	let reversed = $derived(index % 2 === 1);
	let indexLabel = $derived(String(index + 1).padStart(2, '0'));
	let categoryLabel = $derived(project.category === 'game' ? 'game' : 'web');
	let liveLabel = $derived(project.category === 'game' ? 'Play' : 'View Live');
</script>

<article
	class="showcase-row relative w-full overflow-hidden border-b border-slate-800 bg-slate-950"
	style="--row-accent: {accents[accent].color}; --row-accent-glow: {accents[accent]
		.glow}; --row-accent-soft: {accents[accent].soft};"
>
	<div class="flex flex-col lg:flex-row {reversed ? 'lg:flex-row-reverse' : ''}">
		<!-- Image side -->
		<div
			class="scanlines relative aspect-[16/9] w-full overflow-hidden bg-slate-900 lg:aspect-auto lg:min-h-[30rem] lg:w-[58%]"
		>
			{#if project.image}
				<img
					src={project.image}
					alt={project.title}
					loading="lazy"
					class="showcase-img absolute inset-0 h-full w-full object-cover"
				/>
			{:else}
				<div class="absolute inset-0 flex items-center justify-center">
					<span class="font-terminal text-sm tracking-[0.3em] text-slate-600 uppercase">
						no preview
					</span>
				</div>
			{/if}
			<!-- Fade toward the content seam -->
			<div
				class="seam-fade pointer-events-none absolute inset-0 {reversed
					? 'seam-left'
					: 'seam-right'}"
				aria-hidden="true"
			></div>
		</div>

		<!-- Content side -->
		<div
			class="content-col relative flex w-full flex-col justify-center border-slate-800 px-6 py-12 sm:px-10 lg:w-[42%] lg:px-14 lg:py-20 xl:px-20 {reversed
				? 'lg:border-r'
				: 'lg:border-l'}"
		>
			<!-- Ambient accent glow behind content -->
			<div class="content-glow pointer-events-none absolute inset-0" aria-hidden="true"></div>

			<div class="relative max-w-xl">
				<!-- Index / metadata line -->
				<div class="mb-6 flex items-baseline gap-4">
					<span class="index-num font-terminal text-5xl leading-none font-bold text-slate-700 lg:text-6xl">
						{indexLabel}
					</span>
					<span class="h-px flex-1 bg-slate-800" aria-hidden="true"></span>
					<span class="row-accent-text font-terminal text-xs tracking-[0.3em] uppercase">
						{categoryLabel}{project.featured ? ' // featured' : ''}
					</span>
				</div>

				<!-- Title -->
				<h2 class="showcase-title mb-3 text-4xl leading-tight font-bold text-slate-100 md:text-5xl">
					{project.title}
				</h2>
				<div class="title-bar mb-6 h-0.5 w-12" aria-hidden="true"></div>

				<!-- Description -->
				<p class="mb-8 text-base leading-relaxed text-slate-400">
					{project.description}
				</p>

				<!-- Tech stack -->
				<div class="mb-10 flex flex-wrap gap-2">
					{#each project.techStack as tech (tech)}
						<span
							class="tech-tag font-terminal border border-slate-700/80 bg-slate-900/60 px-2.5 py-1 text-xs tracking-wider text-slate-400"
						>
							{tech}
						</span>
					{/each}
				</div>

				<!-- Actions -->
				<div class="flex flex-wrap items-center gap-4">
					{#if project.liveUrl}
						<a
							href={project.liveUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="action-primary font-terminal px-6 py-2.5 text-sm font-bold tracking-wider text-slate-950 uppercase"
						>
							{liveLabel} &nearr;
						</a>
					{/if}
					{#if project.repoUrl}
						<a
							href={project.repoUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="action-secondary font-terminal border border-slate-700 px-6 py-2.5 text-sm tracking-wider text-slate-300 uppercase"
						>
							Source &nearr;
						</a>
					{/if}
					{#if project.devlogUrl}
						<a
							href={project.devlogUrl}
							class="action-secondary font-terminal border border-slate-700 px-6 py-2.5 text-sm tracking-wider text-slate-300 uppercase"
						>
							Devlog &rarr;
						</a>
					{/if}
				</div>
			</div>
		</div>
	</div>
</article>

<style>
	/* Accent line sweeps across the top edge of the row on hover */
	.showcase-row::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		height: 2px;
		width: 0;
		background: var(--row-accent);
		box-shadow: 0 0 12px var(--row-accent-glow);
		transition: width 0.6s ease;
		z-index: 10;
	}

	.showcase-row:hover::after {
		width: 100%;
	}

	/* Image: slightly desaturated at rest, full color + gentle zoom on hover */
	.showcase-img {
		filter: saturate(0.75) brightness(0.85);
		transform: scale(1);
		transition:
			filter 0.45s ease,
			transform 0.6s ease;
	}

	.showcase-row:hover .showcase-img {
		filter: saturate(1.05) brightness(1);
		transform: scale(1.03);
	}

	/* Blend the image into the dark content seam */
	.seam-fade {
		opacity: 0.9;
		transition: opacity 0.45s ease;
	}

	@media (min-width: 1024px) {
		.seam-right {
			background: linear-gradient(90deg, transparent 70%, rgba(2, 6, 23, 0.55) 100%);
		}

		.seam-left {
			background: linear-gradient(270deg, transparent 70%, rgba(2, 6, 23, 0.55) 100%);
		}
	}

	@media (max-width: 1023.98px) {
		.seam-fade {
			background: linear-gradient(180deg, transparent 70%, rgba(2, 6, 23, 0.6) 100%);
		}
	}

	.showcase-row:hover .seam-fade {
		opacity: 0.45;
	}

	/* Soft radial accent wash behind the text column */
	.content-glow {
		background: radial-gradient(ellipse at center, var(--row-accent-soft), transparent 70%);
		opacity: 0.8;
		transition: opacity 0.45s ease;
	}

	.showcase-row:hover .content-glow {
		opacity: 1;
	}

	/* Seam border lights up in accent on hover */
	.content-col {
		transition: border-color 0.45s ease;
	}

	.showcase-row:hover .content-col {
		border-color: var(--row-accent);
	}

	/* Index numeral glows in accent on hover */
	.index-num {
		transition:
			color 0.35s ease,
			text-shadow 0.35s ease;
	}

	.showcase-row:hover .index-num {
		color: var(--row-accent);
		text-shadow: 0 0 18px var(--row-accent-glow);
	}

	.row-accent-text {
		color: var(--row-accent);
	}

	/* Accent bar under the title grows on hover */
	.title-bar {
		background: var(--row-accent);
		transition: width 0.45s ease;
	}

	.showcase-row:hover .title-bar {
		width: 7rem;
	}

	/* Tech tags pick up accent when individually hovered */
	.tech-tag {
		transition:
			border-color 0.25s ease,
			color 0.25s ease;
	}

	.tech-tag:hover {
		border-color: var(--row-accent);
		color: var(--row-accent);
	}

	/* Primary action: filled accent, glow on hover */
	.action-primary {
		background: var(--row-accent);
		transition:
			box-shadow 0.25s ease,
			transform 0.25s ease;
	}

	.action-primary:hover {
		box-shadow: 0 0 20px var(--row-accent-glow);
		transform: translateY(-2px);
	}

	/* Secondary actions: outlined, accent on hover */
	.action-secondary {
		transition:
			border-color 0.25s ease,
			color 0.25s ease,
			box-shadow 0.25s ease;
	}

	.action-secondary:hover {
		border-color: var(--row-accent);
		color: var(--row-accent);
		box-shadow: 0 0 14px var(--row-accent-glow);
	}
</style>

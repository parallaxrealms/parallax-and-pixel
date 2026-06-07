<script lang="ts">
	import ImageLightbox from './ImageLightbox.svelte';

	interface GalleryImage {
		url: string;
		thumbnail?: string;
		caption?: string;
		alt?: string;
	}

	interface Props {
		images: GalleryImage[];
		columns?: number;
		aspectRatio?: string;
		editable?: boolean;
		class?: string;
	}

	let {
		images,
		columns = 3,
		aspectRatio = '16/9',
		editable = false,
		class: className = ''
	}: Props = $props();

	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);

	function openLightbox(index: number) {
		lightboxIndex = index;
		lightboxOpen = true;
	}
</script>

<div
	class="grid gap-3 {className}"
	style="grid-template-columns: repeat({columns}, 1fr);"
>
	{#each images as image, i}
		<button
			class="group relative overflow-hidden border-2 border-slate-700 transition-all hover:scale-[1.02]"
			style="aspect-ratio: {aspectRatio}; hover-border-color: #00a5cf;"
			onclick={() => !editable && openLightbox(i)}
			disabled={editable}
			aria-label={image.alt ?? image.caption ?? `View image ${i + 1}`}
		>
			<img
				src={image.thumbnail ?? image.url}
				alt={image.alt ?? image.caption ?? ''}
				class="h-full w-full object-cover transition-transform group-hover:scale-105"
			/>
			{#if image.caption}
				<div
					class="absolute inset-x-0 bottom-0 px-2 py-1 text-xs text-slate-200"
					style="background: linear-gradient(transparent, rgba(2, 6, 23, 0.8));"
				>
					{image.caption}
				</div>
			{/if}
		</button>
	{/each}
</div>

<ImageLightbox {images} initialIndex={lightboxIndex} bind:open={lightboxOpen} />

<style>
	button:hover {
		border-color: #00a5cf !important;
	}
</style>

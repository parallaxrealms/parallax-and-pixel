<script lang="ts">
	import { X, ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface LightboxImage {
		url: string;
		thumbnail?: string;
		caption?: string;
		alt?: string;
	}

	interface Props {
		images: LightboxImage[];
		initialIndex?: number;
		open: boolean;
	}

	let { images, initialIndex = 0, open = $bindable(false) }: Props = $props();

	let currentIndex = $state(0);

	$effect(() => {
		if (open) {
			currentIndex = initialIndex;
		}
	});

	let currentImage = $derived(images[currentIndex]);
	let hasMultiple = $derived(images.length > 1);

	function close() {
		open = false;
	}

	function next() {
		if (currentIndex < images.length - 1) {
			currentIndex++;
		}
	}

	function prev() {
		if (currentIndex > 0) {
			currentIndex--;
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			close();
		} else if (e.key === 'ArrowRight' && hasMultiple) {
			next();
		} else if (e.key === 'ArrowLeft' && hasMultiple) {
			prev();
		}
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

{#if open && currentImage}
	<div class="lightbox-portal">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[9999] flex items-center justify-center"
			style="background-color: rgba(2, 6, 23, 0.95);"
			onclick={onBackdropClick}
		>
			<!-- Close button -->
			<button
				class="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center text-slate-400 transition-colors hover:text-white"
				onclick={close}
				aria-label="Close lightbox"
			>
				<X class="h-6 w-6" />
			</button>

			<!-- Navigation: Previous -->
			{#if hasMultiple && currentIndex > 0}
				<button
					class="absolute left-4 z-10 flex h-10 w-10 items-center justify-center text-slate-400 transition-colors hover:text-white"
					onclick={prev}
					aria-label="Previous image"
				>
					<ChevronLeft class="h-8 w-8" />
				</button>
			{/if}

			<!-- Navigation: Next -->
			{#if hasMultiple && currentIndex < images.length - 1}
				<button
					class="absolute right-4 z-10 flex h-10 w-10 items-center justify-center text-slate-400 transition-colors hover:text-white"
					onclick={next}
					aria-label="Next image"
				>
					<ChevronRight class="h-8 w-8" />
				</button>
			{/if}

			<!-- Image + Caption -->
			<div class="flex max-h-[90vh] max-w-[90vw] flex-col items-center">
				<img
					src={currentImage.url}
					alt={currentImage.alt ?? currentImage.caption ?? ''}
					class="max-h-[80vh] max-w-full object-contain"
				/>

				{#if currentImage.caption}
					<p
						class="mt-4 max-w-2xl border-l-2 pl-3 font-terminal text-sm text-slate-300"
						style="border-color: #00a5cf;"
					>
						{currentImage.caption}
					</p>
				{/if}

				<!-- Image counter -->
				{#if hasMultiple}
					<p class="mt-2 font-terminal text-xs text-slate-500">
						{currentIndex + 1} / {images.length}
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.lightbox-portal {
		position: fixed;
		top: 0;
		left: 0;
		width: 0;
		height: 0;
		z-index: 9999;
	}
</style>

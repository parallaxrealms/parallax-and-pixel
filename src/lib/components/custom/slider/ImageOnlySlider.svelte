<script lang="ts">
	type Slide = {
		src: string;
		alt?: string;
		caption?: string;
	};

	interface Props {
		slides?: Slide[];
		auto?: boolean;
		interval?: number;
		showArrows?: boolean;
		showDots?: boolean;
	}

	let {
		slides = [],
		auto = true,
		interval = 4500,
		showArrows = true,
		showDots = true
	}: Props = $props();

	let index = $state(0);
	let hovering = $state(false);

	function go(n: number) {
		const len = slides.length || 1;
		index = (n + len) % len;
	}

	// Autoplay (pause while hovering)
	$effect(() => {
		if (!auto || hovering || slides.length <= 1) return;
		const id = setInterval(() => go(index + 1), interval);
		return () => clearInterval(id);
	});

	// Swipe/touch handling
	let startX = 0;
	function onPointerDown(e: PointerEvent) {
		startX = e.clientX;
	}
	function onPointerUp(e: PointerEvent) {
		const dx = e.clientX - startX;
		if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
	}

	// Keyboard navigation
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') go(index - 1);
		if (e.key === 'ArrowRight') go(index + 1);
	}

	let currentSlide = $derived(slides[index]);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="image-only-slider"
	role="region"
	aria-roledescription="carousel"
	aria-label="Image slider"
	aria-live="off"
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onmouseenter={() => (hovering = true)}
	onmouseleave={() => (hovering = false)}
	onkeydown={onKeyDown}
	tabindex={0}
>
	<!-- Slides -->
	{#each slides as slide, i (i)}
		<div
			class="slide"
			style="opacity: {i === index ? 1 : 0};"
			aria-hidden={i !== index}
		>
			<img
				src={slide.src}
				alt={slide.alt || `Slide ${i + 1}`}
				loading={i === 0 ? 'eager' : 'lazy'}
				decoding="async"
			/>
		</div>
	{/each}

	<!-- Caption overlay -->
	{#if currentSlide?.caption}
		<div class="caption">
			<p>{currentSlide.caption}</p>
		</div>
	{/if}

	<!-- Arrow Controls -->
	{#if showArrows && slides.length > 1}
		<button
			type="button"
			class="arrow arrow-left"
			onclick={() => go(index - 1)}
			aria-label="Previous slide"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="15 18 9 12 15 6"></polyline>
			</svg>
		</button>
		<button
			type="button"
			class="arrow arrow-right"
			onclick={() => go(index + 1)}
			aria-label="Next slide"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="9 18 15 12 9 6"></polyline>
			</svg>
		</button>
	{/if}

	<!-- Dot Indicators -->
	{#if showDots && slides.length > 1}
		<div class="dots">
			{#each slides as _, i (i)}
				<button
					type="button"
					class="dot {i === index ? 'active' : ''}"
					aria-label="Go to slide {i + 1}"
					onclick={() => (index = i)}
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.image-only-slider {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background-color: #0f172a;
	}

	.slide {
		position: absolute;
		inset: 0;
		transition: opacity 0.7s ease;
	}

	.slide img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.caption {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 1rem 1.5rem;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
		z-index: 10;
	}

	.caption p {
		font-family: 'Space Mono', monospace;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.9);
		margin: 0;
	}

	.arrow {
		position: absolute;
		top: 50%;
		z-index: 20;
		transform: translateY(-50%);
		padding: 0.5rem;
		border-radius: 9999px;
		background-color: rgba(0, 0, 0, 0.4);
		color: white;
		backdrop-filter: blur(4px);
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.arrow:hover {
		transform: translateY(-50%) scale(1.1);
		background-color: rgba(0, 0, 0, 0.6);
	}

	.arrow-left {
		left: 1rem;
	}

	.arrow-right {
		right: 1rem;
	}

	.dots {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		z-index: 20;
		display: flex;
		transform: translateX(-50%);
		align-items: center;
		gap: 0.5rem;
	}

	.dot {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 9999px;
		background-color: rgba(255, 255, 255, 0.5);
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
	}

	.dot:hover {
		background-color: rgba(255, 255, 255, 0.7);
	}

	.dot.active {
		width: 2rem;
		background-color: #00a5cf;
	}
</style>

<!-- src/lib/components/custom/HeroSlider.svelte -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Slide = {
		src: string;
		alt?: string;
		title?: string;
		subtitle?: string;
		price?: string;
		badge?: string;
		cta?: {
			text: string;
			href?: string;
			onclick?: () => void;
		};
	};

	type Size = 'sm' | 'md' | 'lg' | 'xl' | 'full';
	type Variant = 'default' | 'overlay' | 'minimal';

	interface SliderProps extends HTMLAttributes<HTMLDivElement> {
		slides?: Slide[];
		auto?: boolean;
		interval?: number;
		size?: Size;
		variant?: Variant;
		showArrows?: boolean;
		showDots?: boolean;
		showOverlay?: boolean;
		rounded?: boolean;
		shadow?: boolean;
	}

	let {
		slides = [],
		auto = true,
		interval = 4500,
		size = 'lg',
		variant = 'default',
		showArrows = true,
		showDots = true,
		showOverlay = false,
		rounded = true,
		shadow = true,
		class: className = '',
		...restProps
	} = $props<SliderProps & { children?: any }>();

	// Slider state
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

	// Size classes
	const sizeClasses: any = {
		sm: 'h-[30vh] sm:h-[35vh] md:h-[40vh]',
		md: 'h-[40vh] sm:h-[45vh] md:h-[50vh]',
		lg: 'h-[50vh] sm:h-[55vh] md:h-[60vh] lg:h-[65vh]',
		xl: 'h-[60vh] sm:h-[65vh] md:h-[70vh] lg:h-[75vh]',
		full: 'h-screen'
	};

	// Variant classes
	const variantClasses: any = {
		default: '',
		overlay: 'relative',
		minimal: 'border-0 shadow-none'
	};

	const heightClass = $derived(sizeClasses[size]);
	const variantClass = $derived(variantClasses[variant]);
	const roundedClass = $derived(rounded ? 'rounded-xl overflow-hidden' : '');
	const shadowClass = $derived(shadow && variant !== 'minimal' ? 'shadow-xl' : '');

	const finalClass = $derived(`
		relative w-full overflow-hidden
		${heightClass}
		${variantClass}
		${roundedClass}
		${shadowClass}
		${className}
	`.trim());
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class={finalClass}
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
	{...restProps}
>
	<!-- Overlay (CMY Blobs) -->
	{#if showOverlay}
		<div class="pointer-events-none absolute inset-0 z-10 opacity-10">
			<div
				class="blob-shape absolute left-[10%] top-[10%] h-48 w-48 animate-[float_6s_ease-in-out_infinite] rounded-full bg-cyan-500 opacity-60 blur-3xl"
			></div>
			<div
				class="blob-shape bg-magenta absolute right-[10%] top-[30%] h-40 w-40 animate-[float_8s_ease-in-out_infinite_-2s] rounded-full opacity-40 blur-3xl"
			></div>
			<div
				class="blob-shape absolute bottom-[20%] left-[30%] h-44 w-44 animate-[float_7s_ease-in-out_infinite_-4s] rounded-full bg-yellow-500 opacity-50 blur-3xl"
			></div>
		</div>
	{/if}

	<!-- Slides -->
	{#each slides as slide, i (i)}
		<div
			class="absolute inset-0 transition-opacity duration-700"
			style="opacity: {i === index ? 1 : 0};"
			aria-hidden={i !== index}
		>
			<img
				src={slide.src}
				alt={slide.alt || `Slide ${i + 1}`}
				class="h-full w-full object-cover"
				loading={i === 0 ? 'eager' : 'lazy'}
				decoding="async"
			/>

			<!-- Content Overlay -->
			{#if slide.title || slide.subtitle || slide.price || slide.badge || slide.cta}
				<div
					class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 sm:p-8"
				>
					<div class="mx-auto max-w-4xl">
						{#if slide.badge}
							<span
								class="mb-2 inline-block rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-black"
							>
								{slide.badge}
							</span>
						{/if}

						{#if slide.title}
							<h2 class="mb-2 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
								{slide.title}
							</h2>
						{/if}

						{#if slide.subtitle}
							<p class="mb-4 text-base text-white/90 sm:text-lg">
								{slide.subtitle}
							</p>
						{/if}

						{#if slide.price}
							<div class="mb-4 text-xl font-bold text-[var(--color-primary)] sm:text-2xl">
								{slide.price}
							</div>
						{/if}

						{#if slide.cta}
							{#if slide.cta.href}
								<a
									href={slide.cta.href}
									class="inline-block rounded-lg bg-[var(--color-primary)] px-6 py-3 font-semibold text-black transition-all hover:scale-105 hover:bg-[var(--color-primary-light)]"
								>
									{slide.cta.text}
								</a>
							{:else}
								<button
									type="button"
									onclick={slide.cta.onclick}
									class="rounded-lg bg-[var(--color-primary)] px-6 py-3 font-semibold text-black transition-all hover:scale-105 hover:bg-[var(--color-primary-light)]"
								>
									{slide.cta.text}
								</button>
							{/if}
						{/if}
					</div>
				</div>
			{/if}

			<span class="sr-only">Slide {i + 1} of {slides.length}</span>
		</div>
	{/each}

	<!-- Arrow Controls -->
	{#if showArrows && slides.length > 1}
		<button
			type="button"
			class="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/60"
			onclick={() => go(index - 1)}
			aria-label="Previous slide"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="15 18 9 12 15 6"></polyline>
			</svg>
		</button>

		<button
			type="button"
			class="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/60"
			onclick={() => go(index + 1)}
			aria-label="Next slide"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="9 18 15 12 9 6"></polyline>
			</svg>
		</button>
	{/if}

	<!-- Dot Indicators -->
	{#if showDots && slides.length > 1}
		<div class="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
			{#each slides as _, i}
				<button
					type="button"
					class="h-2.5 w-2.5 rounded-full transition-all {i === index
						? 'w-8 bg-[var(--color-primary)]'
						: 'bg-white/50 hover:bg-white/70'}"
					aria-label="Go to slide {i + 1}"
					onclick={() => (index = i)}
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	@keyframes float {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		33% {
			transform: translateY(-20px) scale(1.05);
		}
		66% {
			transform: translateY(10px) scale(0.95);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.blob-shape {
			animation: none;
		}
	}
</style>

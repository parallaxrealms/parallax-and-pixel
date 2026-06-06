<script lang="ts">
	import { onMount } from 'svelte';
	import createGlobe from 'cobe';
	import { spring } from 'svelte/motion';
	import { cn } from '@parallaxrealms/pxp-utils/core';

	interface Props {
		color?: [number, number, number];
		glowColor?: [number, number, number];
		class?: string;
	}

	let {
		color = [0, 0, 0],
		glowColor = [1, 1, 1],
		class: className = '',
	}: Props = $props();

	let x = spring(0, {
		stiffness: 0.04,
		damping: 0.4,
		precision: 0.005,
	});

	let pointerInteracting: number | null = null;
	let pointerInteractionMovement = 0;
	let canvas: HTMLCanvasElement;
	let phi = 0;
	let width = 0;
	const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1;

	function onResize() {
		if (canvas) {
			width = canvas.offsetWidth;
		}
	}

	function onRender(state: Record<string, number>) {
		if (!pointerInteracting) {
			phi += 0.005;
		}
		state.phi = phi + $x;
		state.width = width * 2;
		state.height = width * 2;
	}

	onMount(() => {
		window.addEventListener('resize', onResize);
		onResize();

		// Wait for next frame to ensure canvas has dimensions
		let globe: ReturnType<typeof createGlobe>;
		const initGlobe = () => {
			width = canvas.offsetWidth || 600;
			globe = createGlobe(canvas, {
				devicePixelRatio: dpr,
				width: width * 2,
				height: width * 2,
				phi: 0,
				theta: 0.3,
				dark: 1,
				diffuse: 0.6,
				mapSamples: 2000,
				mapBrightness: 0,
				baseColor: color,
				markerColor: color,
				glowColor: glowColor,
				markers: [],
				onRender: onRender,
			});
		};

		requestAnimationFrame(initGlobe);

		return () => {
			window.removeEventListener('resize', onResize);
			if (globe) globe.destroy();
		};
	});

	function handlePointerDown(e: PointerEvent) {
		pointerInteracting = e.clientX - pointerInteractionMovement;
		canvas.style.cursor = 'grabbing';
	}

	function handlePointerUp() {
		pointerInteracting = null;
		canvas.style.cursor = 'grab';
	}

	function handlePointerOut() {
		pointerInteracting = null;
		canvas.style.cursor = 'grab';
	}

	function handleMouseMove(e: MouseEvent) {
		if (pointerInteracting !== null) {
			const delta = e.clientX - pointerInteracting;
			pointerInteractionMovement = delta;
			x.set(delta / 200);
		}
	}
</script>

<div class={cn('aspect-square', className)}>
	<canvas
		class="h-full w-full cursor-grab"
		bind:this={canvas}
		onpointerdown={handlePointerDown}
		onpointerup={handlePointerUp}
		onpointerout={handlePointerOut}
		onmousemove={handleMouseMove}
	></canvas>
</div>

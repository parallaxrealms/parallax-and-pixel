<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	// @ts-expect-error - satorimesh is an optional dependency, stub type used
	import type { Gradient as GradientType } from '$lib/satorimesh/mesh.js';

	interface Props {
		/** Canvas ID - must be unique per page */
		canvasId?: string;
		/** Fade in duration in seconds */
		fadeInDuration?: number;
		/** Delay before starting mesh load in ms */
		loadDelay?: number;
		/** Custom CSS classes for the canvas */
		class?: string;
		/** Whether to wait for full page load before showing animation */
		waitForPageLoad?: boolean;
		/** Custom gradient colors (hex values without #) */
		gradientColors?: {
			color1?: string;
			color2?: string;
			color3?: string;
			color4?: string;
		};
		/** Whether to enable darken top effect, this acts like a multiply effect for colors */
		darkenTop?: boolean;
		/** Overlay configuration to darken the canvas */
		overlay?: {
			/** Whether to show overlay */
			enabled: boolean;
			/** Overlay opacity (0-1) */
			opacity?: number;
			/** Overlay z-index */
			zIndex?: number;
			/** Overlay color (defaults to black) */
			color?: string;
		};
		/** Whether to add a bottom fade to black overlay */
		bottomFadesToBlack?: boolean;
	}

	let {
		canvasId = 'mesh-animated-canvas',
		fadeInDuration = 2,
		loadDelay = 100,
		class: className = '',
		waitForPageLoad = true,
		gradientColors = {
			color1: '#000000',
			color2: '#de4f4f',
			color3: '#49d4d2',
			color4: '#eed65d'
		},
		darkenTop = true,
		overlay = { enabled: false },
		bottomFadesToBlack = false
	}: Props = $props();

	// State
	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let pageLoaded = $state(false);
	let meshLoaded = $state(false);
	let meshInstance: GradientType | undefined;

	// Computed state for canvas visibility
	let showCanvas = $derived(waitForPageLoad ? pageLoaded && meshLoaded : meshLoaded);

	// CSS custom properties for gradient colors
	let cssVars = $derived({
		'--gradient-color-1': gradientColors.color1,
		'--gradient-color-2': gradientColors.color2,
		'--gradient-color-3': gradientColors.color3,
		'--gradient-color-4': gradientColors.color4
	});

	// Load mesh
	async function loadMesh() {
		if (!browser || !canvasElement) return;

		try {
			// Small delay to ensure DOM is fully settled
			await new Promise((resolve) => setTimeout(resolve, loadDelay));

			// @ts-expect-error - satorimesh is an optional dependency
			const { Gradient } = await import('$lib/satorimesh/mesh.js');
			const instance = new Gradient();
			instance.initGradient(`#${canvasId}`);
			meshInstance = instance;

			// Mark mesh as loaded after a brief moment to ensure it's actually rendering
			setTimeout(() => {
				meshLoaded = true;
			}, 200);
		} catch (err) {
			console.error('Failed to load mesh:', err);
			// Fallback: show canvas anyway after a timeout
			setTimeout(() => {
				meshLoaded = true;
			}, 1000);
		}
	}

	onMount(async () => {
		if (!browser) return;

		if (waitForPageLoad) {
			// Wait for page to be fully loaded
			if (document.readyState === 'complete') {
				pageLoaded = true;
			} else {
				window.addEventListener('load', () => {
					pageLoaded = true;
				});
			}

			// Load mesh after page is ready
			await new Promise((resolve) => {
				if (pageLoaded) {
					resolve(void 0);
				} else {
					const checkLoaded = () => {
						if (pageLoaded) {
							resolve(void 0);
						} else {
							requestAnimationFrame(checkLoaded);
						}
					};
					checkLoaded();
				}
			});
		}

		await loadMesh();
	});

	onDestroy(() => {
		meshInstance?.disconnect?.();
	});
</script>

<!-- Canvas with progressive loading -->
<canvas
	id={canvasId}
	bind:this={canvasElement}
	data-js-darken-top={darkenTop ? '' : undefined}
	data-transition-in
	class="animated-mesh-bg {className}"
	class:canvas-visible={showCanvas}
	style:--fade-duration="{fadeInDuration}s"
	style={Object.entries(cssVars)
		.map(([key, value]) => `${key}:${value}`)
		.join(';')}
></canvas>

<!-- Optional overlay to darken the canvas -->
{#if overlay.enabled}
	<div
		class="mesh-overlay"
		class:overlay-visible={showCanvas}
		style:opacity={overlay.opacity ?? 0.3}
		style:z-index={overlay.zIndex ?? -1}
		style:background-color={overlay.color ?? '#000000'}
		style:--fade-duration="{fadeInDuration}s"
	></div>
{/if}

<!-- Bottom fade to black overlay -->
{#if bottomFadesToBlack}
	<div
		class="bottom-fade-overlay"
		class:fade-visible={showCanvas}
		style:--fade-duration="{fadeInDuration}s"
	></div>
{/if}

<style>
	.animated-mesh-bg {
		position: absolute;
		z-index: -1;
		width: 100%;
		height: 100%;
		max-height: 1000px;
		background-color: #000000;
		opacity: 0;
		transition: opacity var(--fade-duration, 2s) ease-in-out;
		--gradient-color-1: #000000;
		--gradient-color-2: #de4f4f;
		--gradient-color-3: #49d4d2;
		--gradient-color-4: #eed65d;
	}

	.animated-mesh-bg.canvas-visible {
		opacity: 1;
	}

	.mesh-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--fade-duration, 2s) ease-in-out;
	}

	.mesh-overlay.overlay-visible {
		opacity: var(--overlay-opacity, 0.3);
	}

	.bottom-fade-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		max-height: 1000px; /* Match the canvas max-height */
		pointer-events: none;
		z-index: 1;
		opacity: 0;
		transition: opacity var(--fade-duration, 2s) ease-in-out;
		background: linear-gradient(to bottom, transparent 0%, transparent 75%, #000000 100%);
	}

	.bottom-fade-overlay.fade-visible {
		opacity: 1;
	}
</style>

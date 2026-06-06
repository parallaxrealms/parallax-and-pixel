<script lang="ts">
	/**
	 * ModelScene — thin Svelte wrapper around the config-driven three.js
	 * engine (./engine.ts). The engine module is dynamically imported in
	 * onMount so no three.js code ever evaluates during SSR.
	 *
	 * The canvas fills its container absolutely and shows the procedural
	 * fallback immediately — no fade-in, no loading state.
	 *
	 * config.overlay renders a pure-CSS DOM stack above the canvas:
	 * tint/gradient → corner vignette → scanlines. The engine never sees it.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { ModelSceneHandle, ModelSceneProps } from './types';

	let { config, onReady, onHandle, class: className = '' }: ModelSceneProps = $props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let handle: ModelSceneHandle | null = $state(null);

	onMount(() => {
		if (!browser || !canvas) return;

		let destroyed = false;
		let local: ModelSceneHandle | null = null;

		(async () => {
			const { createModelScene } = await import('./engine');
			if (destroyed || !canvas) return;
			local = createModelScene(canvas, config);
			handle = local;
			onHandle?.(local);
			local.ready.then(() => {
				if (!destroyed) onReady?.();
			});
		})();

		return () => {
			destroyed = true;
			handle = null;
			local?.dispose();
		};
	});

	// Re-apply on any config change. cloneConfig inside applyConfig reads every
	// nested property synchronously, so deep $state configs are fully tracked.
	$effect(() => {
		handle?.applyConfig(config);
	});

	// ----- overlay styles (pure CSS, derived from config.overlay) -------------

	/** '#rrggbb' + 0-1 alpha → rgba() string. */
	function rgba(hex: string, alpha: number): string {
		const r = parseInt(hex.slice(1, 3), 16) || 0;
		const g = parseInt(hex.slice(3, 5), 16) || 0;
		const b = parseInt(hex.slice(5, 7), 16) || 0;
		return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
	}

	let overlay = $derived(config.overlay);

	let tintStyle = $derived.by(() => {
		if (!overlay?.on || overlay.opacity <= 0) return null;
		if (overlay.gradient.on) {
			return `background: linear-gradient(${overlay.gradient.angle}deg, ${rgba(
				overlay.gradient.from,
				overlay.opacity
			)}, ${rgba(overlay.gradient.to, overlay.opacity)});`;
		}
		return `background: ${rgba(overlay.color, overlay.opacity)};`;
	});

	// `ellipse farthest-corner` tracks the container's aspect ratio, and the
	// transparent stop keeps the center untouched — only corners darken.
	let vignetteStyle = $derived.by(() => {
		if (!overlay?.on || !overlay.vignette.on || overlay.vignette.strength <= 0) return null;
		const clear = Math.max(0, 100 - overlay.vignette.size);
		return `background: radial-gradient(ellipse farthest-corner at center, rgba(0, 0, 0, 0) ${clear}%, ${rgba(
			'#000000',
			overlay.vignette.strength
		)} 100%);`;
	});

	let scanlineStyle = $derived.by(() => {
		if (!overlay?.on || !overlay.scanlines.on || overlay.scanlines.opacity <= 0) return null;
		const period = Math.max(2, overlay.scanlines.scale);
		const half = period / 2;
		return `background: repeating-linear-gradient(0deg, transparent, transparent ${half}px, ${rgba(
			'#000000',
			overlay.scanlines.opacity
		)} ${half}px, ${rgba('#000000', overlay.scanlines.opacity)} ${period}px);`;
	});
</script>

<div class="pointer-events-none absolute inset-0 overflow-hidden {className}">
	<canvas bind:this={canvas} class="absolute inset-0 block h-full w-full"></canvas>

	{#if tintStyle}
		<div aria-hidden="true" class="absolute inset-0" style={tintStyle}></div>
	{/if}
	{#if vignetteStyle}
		<div aria-hidden="true" class="absolute inset-0" style={vignetteStyle}></div>
	{/if}
	{#if scanlineStyle}
		<div aria-hidden="true" class="absolute inset-0" style={scanlineStyle}></div>
	{/if}
</div>

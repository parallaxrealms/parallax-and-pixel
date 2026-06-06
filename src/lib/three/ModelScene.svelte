<script lang="ts">
	/**
	 * ModelScene — thin Svelte wrapper around the config-driven three.js
	 * engine (./engine.ts). The engine module is dynamically imported in
	 * onMount so no three.js code ever evaluates during SSR.
	 *
	 * The canvas fills its container absolutely and shows the procedural
	 * fallback immediately — no fade-in, no loading state.
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
</script>

<div class="pointer-events-none absolute inset-0 overflow-hidden {className}">
	<canvas bind:this={canvas} class="absolute inset-0 block h-full w-full"></canvas>
</div>

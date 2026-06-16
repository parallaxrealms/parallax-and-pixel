<script lang="ts">
	// Inline DAEDALUS viewer — the non-dialog embed. Drop a scene into any tab or
	// page region; it sizes to its container and inherits the host mode's theme
	// (so it blends in), unlike DaedalusDialog which forces the cobalt theme.
	import DaedalusViewer from './DaedalusViewer.svelte';
	import type { SceneDoc } from './schema';

	let {
		scene,
		height = '420px',
		class: className = ''
	}: { scene: SceneDoc; height?: string; class?: string } = $props();
</script>

<div class="dv {className}" style="height: {height};">
	<DaedalusViewer {scene} editable={false} />
</div>

<style>
	.dv {
		width: 100%;
		display: flex;
		min-height: 0;
	}
	.dv > :global(*) {
		flex: 1;
		min-width: 0;
	}
</style>

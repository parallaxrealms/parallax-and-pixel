<script lang="ts">
	import '../../../app.css';

	let { children } = $props();
</script>

<div class="editor-layout">
	{@render children?.()}
</div>

<style>
	.editor-layout {
		min-height: 100vh;
		background-color: var(--dashboard-bg);
	}
</style>

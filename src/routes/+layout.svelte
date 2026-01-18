<script lang="ts">
	import '../app.css';
	import { Toaster } from '$lib/components/shadcn/ui/sonner';
	let { children } = $props();
</script>

<svelte:head>
	<script>
		document.documentElement.classList.add('dark');
	</script>
</svelte:head>

<Toaster />

<div id="oro" class="dark">
	{@render children()}
</div>

<style>
	#oro {
		background-color: transparent;
	}
</style>

<script lang="ts">
	import '../app.css';
	import { Toaster } from '$lib/components/shadcn/ui/sonner';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	let { children } = $props();

	onMount(() => {
		// First-party Web Vitals → /api/telemetry/vitals → OTel collector.
		// Dynamic import keeps web-vitals off the SSR bundle and critical path.
		void import('@parallaxrealms/pxp-otel/client').then(({ initWebVitals }) =>
			initWebVitals({ route: page.route.id ?? undefined })
		);
	});
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

<script lang="ts">
	// Layout reset for the PDF report route.
	//
	// `@` breaks out of `audit/+layout.svelte` (which renders the site Nav +
	// shell chrome) and resets to the ROOT layout. The report is captured by
	// Playwright as a standalone document, so it must NOT inherit any site
	// navigation, padding, or background gradients — it is fully self-contained
	// in +page.svelte's own <style> + <svelte:head>.
	let { children } = $props();
</script>

{@render children()}

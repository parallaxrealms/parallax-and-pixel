<script lang="ts">
	// Renders a JSON-LD structured data script tag into <svelte:head>.
	// Complements the base Website schema injected by @parallaxrealms/components-core SEO.
	let { data }: { data: Record<string, unknown> } = $props();

	// Escape `<` so dynamic content (e.g. post titles) can never close the script tag
	const json = $derived(
		JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c')
	);
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${json}</script>`}
</svelte:head>

<script lang="ts">
	import Nav from '$lib/components/custom/nav/Nav.svelte';
	import Footer from '$lib/components/snippets/Footer.svelte';

	let { data, children } = $props();
	let supabase = $derived(data.supabase);
</script>

<Nav {supabase} {data} variant="site" navbarLinks={data.navbarLinks} />

{@render children()}

<Footer />

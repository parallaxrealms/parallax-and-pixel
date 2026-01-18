<script lang="ts">
	import Nav from '$lib/components/custom/nav/Nav.svelte';

	let { data, children } = $props();
	let supabase = $derived(data.supabase);
</script>

<Nav {supabase} {data} variant="dashboard" navbarLinks={data.navbarLinks} />

{@render children()}

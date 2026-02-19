<script lang="ts">
	import { page } from '$app/stores';
	import Nav from '$lib/components/custom/nav/Nav.svelte';

	let { data, children } = $props();
	let supabase = $derived(data.supabase);

	// Hide global nav on editor pages (they have their own navbar)
	let isEditorPage = $derived($page.url.pathname.startsWith('/editor/'));
</script>

{#if !isEditorPage}
	<Nav {supabase} {data} variant="dashboard" navbarLinks={data.navbarLinks} />
{/if}

{@render children()}

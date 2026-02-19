<script lang="ts">
	import Nav from '$lib/components/custom/nav/Nav.svelte';
	import Footer from '$lib/components/snippets/Footer.svelte';
	import Orb from '$lib/components/custom/effect/Orb.svelte';

	let { data, children } = $props();
	let supabase = $derived(data.supabase);
</script>

<Nav {supabase} {data} variant="site" navbarLinks={data.navbarLinks} />

<div class="relative min-h-screen overflow-hidden bg-black">
	<!-- Animated gradient background -->
	<div
		class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,165,207,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(159,255,203,0.1),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(37,161,142,0.1),transparent_50%)]"
	></div>

	<!-- Orb - behind content, in front of background -->
	<div class="absolute inset-x-0 -top-[50%] z-[5] flex justify-center">
		<Orb
			color={[0.05, 0.08, 0.12]}
			glowColor={[0, 0.45, 0.55]}
			class="min-w-[1200px] w-full"
		/>
	</div>

	<!-- Scanline overlay -->
	<div
		class="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)] opacity-30"
	></div>

	<!-- Content -->
	<div class="relative z-10 flex min-h-screen items-center justify-center px-6 py-24">
		{@render children()}
	</div>
</div>

<Footer />

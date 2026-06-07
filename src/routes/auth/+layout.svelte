<script lang="ts">
	import Nav from '$lib/components/custom/nav/Nav.svelte';
	import Footer from '$lib/components/snippets/Footer.svelte';
	import Orb from '$lib/components/custom/effect/Orb.svelte';
	import ModelScene from '$lib/three/ModelScene.svelte';
	import { HERO_SCENE_CONFIG } from '$lib/three/heroConfig';

	let { data, children } = $props();
	let supabase = $derived(data.supabase);
</script>

<Nav {supabase} {data} variant="site" navbarLinks={data.navbarLinks} />

<div class="relative min-h-screen overflow-hidden bg-black">
	<!-- Animated gradient background -->
	<div
		aria-hidden="true"
		class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,165,207,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(159,255,203,0.1),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(37,161,142,0.1),transparent_50%)]"
	></div>

	<!-- Orb (fresnel globe) - behind the lab scene, in front of the gradient bg -->
	<div aria-hidden="true" class="absolute inset-x-0 -top-[50%] z-[5] flex justify-center">
		<Orb
			color={[0.05, 0.08, 0.12]}
			glowColor={[0, 0.45, 0.55]}
			class="min-w-[1200px] w-full"
		/>
	</div>

	<!-- Three.js lab scene - transparent canvas layered OVER the globe, with the
	     tint/vignette/scanline overlay stack handled internally via HERO_SCENE_CONFIG. -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 z-[6]">
		<ModelScene config={HERO_SCENE_CONFIG} />
	</div>

	<!-- Content -->
	<div class="relative z-10 flex min-h-screen items-center justify-center px-4 py-24">
		{@render children()}
	</div>
</div>

<Footer />

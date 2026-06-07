<script lang="ts">
	import { page } from '$app/state';
	import { SEO } from '@parallaxrealms/pxp-components';
	import { goto } from '$app/navigation';

	let error = $derived(page.error);
	let errorMessage = $derived(error?.message || 'An unexpected error occurred');
	let statusCode = $derived(page.status || 500);

	const goBack = () => {
		if (typeof history !== 'undefined') {
			history.back();
		}
	};

	const goHome = () => {
		goto('/');
	};
</script>

<SEO title="Error {statusCode}" />

<div class="w-full max-w-md">
	<!-- Terminal panel (About-terminal CRT frame, translucent) -->
	<div
		class="w-full border border-cyan-800/40 bg-slate-900/60 p-6 text-center backdrop-blur-sm shadow-[inset_0_0_60px_rgba(0,165,207,0.04),0_0_30px_rgba(0,165,207,0.08)] sm:p-8"
	>
		<!-- Prompt -->
		<div class="mb-6 text-left font-terminal text-sm text-accent-highlight">
			<span class="text-slate-500">parallax@dev:~$</span> auth --status<span class="cursor-blink">_</span>
		</div>

		<h1 class="mb-2 font-terminal text-6xl font-bold text-accent-primary sm:text-7xl">
			{statusCode}
		</h1>

		<h2 class="mb-6 text-2xl font-bold text-slate-100">
			{#if statusCode === 404}
				Page Not Found
			{:else if statusCode === 403}
				Access Denied
			{:else if statusCode === 401}
				Unauthorized
			{:else if statusCode === 500}
				Server Error
			{:else}
				Something Went Wrong
			{/if}
		</h2>

		<div class="mb-8 border border-red-500/30 bg-red-500/10 p-4 font-terminal text-sm text-slate-400">
			<p>{errorMessage}</p>
		</div>

		<div class="flex flex-col justify-center gap-4 sm:flex-row">
			<button
				class="w-full cursor-pointer border border-accent-primary bg-transparent px-6 py-3 font-terminal text-sm font-bold tracking-wide text-accent-primary transition-all hover:bg-accent-primary hover:text-slate-950 sm:w-auto"
				onclick={goBack}
			>
				Go Back
			</button>

			<button
				class="w-full cursor-pointer border border-accent-primary bg-transparent px-6 py-3 font-terminal text-sm font-bold tracking-wide text-accent-primary transition-all hover:bg-accent-primary hover:text-slate-950 sm:w-auto"
				onclick={goHome}
			>
				Go Home
			</button>
		</div>

		<!-- Footer prompt -->
		<div class="mt-8 text-left font-terminal text-sm text-slate-500">
			parallax@dev:~$ <span class="cursor-blink text-accent-highlight">_</span>
		</div>
	</div>
</div>

<style>
	.cursor-blink {
		animation: blink 1s step-end infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
</style>

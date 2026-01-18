<script lang="ts">
	import { page } from '$app/state';
	import { SEO, InView } from '@parallaxrealms/components-core';
	import { MessageSquareWarning } from 'lucide-svelte';
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

<div class="home relative h-full w-full">
	<div class="home-content absolute inset-0 z-30 flex flex-col items-center justify-center px-4">
		<InView animation="fade-up" duration={1000} class="error-container w-full max-w-lg rounded-lg p-8">
			<h1
				class="from-satori-red to-satori-purple mb-2 bg-gradient-to-r bg-clip-text text-6xl font-bold text-transparent"
			>
				{statusCode}
			</h1>

			<h2 class="mb-6 text-xl font-semibold text-white">
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

			<div class="my-4 rounded bg-slate-800/20 p-4 text-slate-300">
				<div class="center-center flex">
					<MessageSquareWarning size="40" strokeWidth="1.25" />
					<p class="ml-4">{errorMessage}</p>
				</div>
			</div>

			<div class="flex-1 flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
				<button class=" bg-transparent transition-all duration-300" onclick={goBack}>
					<p class="text-lg font-semibold tracking-wider">Go Back</p>
				</button>

				<button class=" bg-transparent transition-all duration-300" onclick={goHome}>
					<p class="text-lg font-semibold tracking-wider">Go Home</p>
				</button>
			</div>
		</InView>
	</div>
</div>

<style>
	.home {
		position: relative;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 1);
	}

	.home-content {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 20;
	}
</style>

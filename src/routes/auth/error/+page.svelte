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

<div class="error-page">
	<div class="error-background"></div>
	<div class="error-content">
		<div class="error-container">
			<h1 class="error-code">
				{statusCode}
			</h1>

			<h2 class="error-title">
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

			<div class="error-message">
				<p>{errorMessage}</p>
			</div>

			<div class="error-actions">
				<button class="error-btn" onclick={goBack}>
					Go Back
				</button>

				<button class="error-btn" onclick={goHome}>
					Go Home
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.error-page {
		position: relative;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #020617; /* slate-950 */
	}

	.error-background {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 50% 0%, rgba(0, 165, 207, 0.15) 0%, transparent 50%),
			radial-gradient(circle at 0% 50%, rgba(37, 161, 142, 0.1) 0%, transparent 50%),
			radial-gradient(circle at 100% 50%, rgba(159, 255, 203, 0.1) 0%, transparent 50%);
		opacity: 0.6;
	}

	.error-content {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	:global(.error-container) {
		width: 100%;
		max-width: 32rem;
		background-color: #1e293b; /* slate-800 */
		border: 1px solid #334155; /* slate-700 */
		padding: 2rem;
		text-align: center;
	}

	.error-code {
		margin-bottom: 0.5rem;
		background: linear-gradient(to right, #00a5cf, #9fffcb, #25a18e);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-size: 4rem;
		font-weight: 700;
		font-family: 'Space Mono', monospace;
	}

	.error-title {
		margin-bottom: 1.5rem;
		font-size: 1.5rem;
		font-weight: 600;
		color: #f1f5f9;
		font-family: 'Space Mono', monospace;
	}

	.error-message {
		margin-bottom: 2rem;
		padding: 1rem;
		background-color: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.error-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}

	.error-btn {
		padding: 0.75rem 1.5rem;
		background-color: transparent;
		border: 1px solid #00a5cf;
		color: #00a5cf;
		font-family: 'Space Mono', monospace;
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		transition: all 200ms;
		cursor: pointer;
	}

	.error-btn:hover {
		background-color: #00a5cf;
		color: #020617;
	}

	@media (max-width: 640px) {
		.error-code {
			font-size: 3rem;
		}

		.error-title {
			font-size: 1.25rem;
		}

		.error-actions {
			flex-direction: column;
		}

		.error-btn {
			width: 100%;
		}
	}
</style>

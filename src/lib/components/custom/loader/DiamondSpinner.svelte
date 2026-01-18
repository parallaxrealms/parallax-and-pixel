<script lang="ts">
	type Size = 'sm' | 'md' | 'lg' | 'xl';

	interface Props {
		size?: Size;
		text?: string;
		class?: string;
	}

	let { size = 'md', text = '', class: className = '' }: Props = $props();

	const sizeClasses: Record<Size, string> = {
		sm: 'h-4 w-4 border',
		md: 'h-8 w-8 border-2',
		lg: 'h-12 w-12 border-2',
		xl: 'h-16 w-16 border-[3px]'
	};
</script>

<div class="diamond-spinner-container {className}">
	<div class="diamond-spinner {sizeClasses[size]}"></div>
	{#if text}
		<p class="diamond-spinner-text font-terminal">{text}</p>
	{/if}
</div>

<style>
	.diamond-spinner-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.diamond-spinner {
		border-color: #334155; /* slate-700 */
		border-top-color: var(--accent-primary, #00a5cf);
		animation: diamond-spin 0.8s linear infinite;
	}

	.diamond-spinner-text {
		color: var(--accent-primary, #00a5cf);
		font-size: 0.875rem;
	}

	@keyframes diamond-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

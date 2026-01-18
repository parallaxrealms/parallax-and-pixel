<!-- src/lib/components/custom/ShineButton.svelte -->
<script lang="ts">
	import { cn } from '@parallaxrealms/utils-core';

	type TColorProp = string | string[];

	let {
		children,
		borderRadius = 'md',
		borderWidth = 2,
		duration = 14,
		color,
		variant = 'primary',
		class: className = '',
		onclick
	} = $props<{
		children?: any;
		borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
		borderWidth?: number;
		duration?: number;
		color?: TColorProp;
		variant?: 'primary' | 'secondary' | 'accent';
		class?: string;
		onclick?: (event: MouseEvent) => void;
	}>();

	// Use theme colors if no custom color provided
	let shimmerColors = $derived.by(() => {
		if (color) {
			return Array.isArray(color) ? color : [color];
		}
		// Default to theme colors based on variant
		switch (variant) {
			case 'secondary':
				return ['var(--color-secondary)', 'var(--color-secondary-light)'];
			case 'accent':
				return ['var(--color-accent)', 'var(--color-accent-light)'];
			default:
				return ['var(--color-primary)', 'var(--color-primary-light)'];
		}
	});

	const radiusMap: any = {
		none: 'var(--border-radius-none)',
		sm: 'var(--border-radius-sm)',
		md: 'var(--border-radius-md)',
		lg: 'var(--border-radius-lg)',
		xl: 'var(--border-radius-xl)',
		full: 'var(--border-radius-full)'
	};

	let borderRadiusValue = $derived(radiusMap[borderRadius]);
</script>

<button
	type="button"
	{onclick}
	style="
		--shine-border-radius: {borderRadiusValue};
		--shine-border-width: {borderWidth}px;
		--shine-pulse-duration: {duration}s;
		--shine-colors: {shimmerColors.join(',')};
	"
	class={cn('shine-button', className)}
>
	<div class="shine-border"></div>
	<div class="shine-content">
		{@render children?.()}
	</div>
</button>

<style>
	.shine-button {
		position: relative;
		display: inline-grid;
		place-items: center;
		min-height: 3.75rem;
		min-width: 18.75rem;
		padding: var(--spacing-md);
		border-radius: var(--shine-border-radius);
		background-color: var(--color-surface);
		border: none;
		cursor: pointer;
		overflow: hidden;
		transition: all var(--transition-normal);
	}

	.shine-button:hover {
		box-shadow: var(--shadow-lg);
		transform: translateY(-2px);
	}

	.shine-button:active {
		transform: translateY(0);
	}

	.shine-border {
		position: absolute;
		inset: 0;
		border-radius: var(--shine-border-radius);
		padding: var(--shine-border-width);
		background: radial-gradient(
			transparent,
			transparent,
			var(--shine-colors),
			transparent,
			transparent
		);
		background-size: 300% 300%;
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask-composite: exclude;
		animation: shine-pulse var(--shine-pulse-duration) infinite linear;
	}

	.shine-content {
		position: relative;
		z-index: 1;
		color: var(--color-text);
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-md);
	}

	/* Shine effect on hover */
	.shine-button::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.3), transparent);
		transition: all var(--transition-slow);
	}

	.shine-button:hover::before {
		left: 100%;
		transition-duration: 0.7s;
	}

	@keyframes shine-pulse {
		0% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0% 50%;
		}
	}

	/* Dark mode adjustments */
	:global(.dark) .shine-button {
		background-color: var(--color-surface);
	}
</style>

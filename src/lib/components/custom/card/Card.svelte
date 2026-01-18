<!-- src/lib/components/custom/Card.svelte -->
<script lang="ts" module>
	export interface CardProps {
		variant?: 'default' | 'outlined' | 'filled' | 'elevated' | 'ghost' | 'custom';
		size?: 'sm' | 'md' | 'lg' | 'xl';
		radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
		shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'inner';
		unstyled?: boolean;
		class?: string;
		onclick?: (event: MouseEvent) => void;

		/** Hover effects */
		hoverable?: boolean;
		hoverScale?: number; // e.g. 1.05
	}
</script>

<script lang="ts">
	import { cn } from '@parallaxrealms/utils-core';

	let {
		variant = 'default',
		size = 'md',
		radius = 'md',
		shadow = 'none',
		unstyled = false,
		class: className = '',
		onclick,
		hoverable = false,
		hoverScale = 1.02,
		children,
		...restProps
	} = $props<CardProps & { children?: any }>();

	const isCustom = $derived(variant === 'custom' || unstyled);

	const variantClasses: Record<string, string> = {
		default: 'card-default',
		outlined: 'card-outlined',
		filled: 'card-filled',
		elevated: 'card-elevated',
		ghost: 'card-ghost',
		custom: ''
	};

	const sizeClasses: Record<string, string> = {
		sm: 'p-3',
		md: 'p-4',
		lg: 'p-6',
		xl: 'p-8'
	};

	const radiusClasses: Record<string, string> = {
		none: 'rounded-none',
		sm: 'rounded-sm',
		md: 'rounded-md',
		lg: 'rounded-lg',
		xl: 'rounded-xl',
		'2xl': 'rounded-2xl',
		full: 'rounded-full'
	};

	const shadowClasses: Record<string, string> = {
		none: 'shadow-none',
		sm: 'shadow-sm',
		md: 'shadow-md',
		lg: 'shadow-lg',
		xl: 'shadow-xl',
		'2xl': 'shadow-2xl',
		inner: 'shadow-inner'
	};

	// Inline style for hover scale
	const hoverStyles = $derived(
		hoverable
			? {
					'--card-hover-scale': hoverScale
				}
			: {}
	);

	let cardClasses = $derived(
		isCustom
			? cn('card-base', hoverable && 'card-hoverable', className)
			: cn(
					'card',
					variantClasses[variant],
					sizeClasses[size],
					radiusClasses[radius],
					shadowClasses[shadow],
					hoverable && 'card-hoverable',
					className
				)
	);
</script>

{#if onclick}
	<div class={cardClasses} style={hoverStyles} role="button" tabindex="0" {onclick} {...restProps}>
		{@render children?.()}
	</div>
{:else}
	<div class={cardClasses} style={hoverStyles} {...restProps}>
		{@render children?.()}
	</div>
{/if}

<style>
	/* Base structural styles - always applied to custom variant */
	.card-base {
		display: block;
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
	}

	/* Core card styles - structural only */
	.card {
		display: block;
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
		transition: all 150ms ease-in-out;
	}

	.card:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	/* Variant structures - no colors, just structural differences */
	.card-default {
		border-width: 1px;
		border-style: solid;
	}

	.card-outlined {
		background-color: transparent;
		border-width: 2px;
		border-style: solid;
	}

	.card-filled {
		border: none;
	}

	.card-elevated {
		border-width: 1px;
		border-style: solid;
	}

	.card-ghost {
		background-color: transparent;
		border: none;
	}

	/* Hoverable - structural hover effects */
	.card-hoverable {
		cursor: pointer;
		transition:
			transform 200ms ease-in-out,
			box-shadow 200ms ease-in-out;
	}

	.card-hoverable:hover {
		transform: scale(var(--card-hover-scale, 1.02));
	}

	/* Reduce motion */
	@media (prefers-reduced-motion: reduce) {
		.card,
		.card-hoverable {
			transition: none;
		}

		.card-hoverable:hover {
			transform: none;
		}
	}
</style>

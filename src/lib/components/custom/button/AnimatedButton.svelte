<!-- src/lib/components/special/AnimatedButton.svelte -->
<script lang="ts" module>
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

	export interface AnimatedButtonProps {
		gradient?:
			| 'cmy'
			| 'primary'
			| 'secondary'
			| 'accent'
			| 'success'
			| 'warning'
			| 'error'
			| 'custom';
		size?: 'sm' | 'md' | 'lg';
		radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		class?: string;
		onclick?: (event: MouseEvent) => void;
		name?: string;
		value?: string;
		// Custom gradient colors
		customColors?: string[];
		animationDuration?: string;
	}

	export type AnimatedButtonButtonProps = AnimatedButtonProps &
		Omit<HTMLButtonAttributes, keyof AnimatedButtonProps>;
	export type AnimatedButtonLinkProps = AnimatedButtonProps &
		Omit<HTMLAnchorAttributes, keyof AnimatedButtonProps>;
</script>

<script lang="ts">
	import { cn } from '@parallaxrealms/utils-core';

	let {
		gradient = '',
		size = '',
		radius = '',
		href,
		type = 'button',
		disabled = false,
		loading = false,
		class: className = 'px-4',
		onclick = () => {},
		name,
		value,
		customColors = [],
		animationDuration = '3s',
		children,
		...restProps
	} = $props<(AnimatedButtonButtonProps | AnimatedButtonLinkProps) & { children?: any }>();

	const sizeClasses: Record<string, string> = {
		sm: 'animated-btn-sm',
		md: 'animated-btn-md',
		lg: 'animated-btn-lg'
	};

	const radiusClasses: Record<string, string> = {
		none: 'animated-btn-radius-none',
		sm: 'animated-btn-radius-sm',
		md: 'animated-btn-radius-md',
		lg: 'animated-btn-radius-lg',
		xl: 'animated-btn-radius-xl',
		'2xl': 'animated-btn-radius-2xl',
		full: 'animated-btn-radius-full'
	};

	const gradientClasses: Record<string, string> = {
		cmy: 'gradient-cmy',
		primary: 'gradient-primary',
		secondary: 'gradient-secondary',
		accent: 'gradient-accent',
		success: 'gradient-success',
		warning: 'gradient-warning',
		error: 'gradient-error',
		custom: 'gradient-custom'
	};

	// Build custom gradient style if using custom colors
	const customGradientStyle = $derived(
		gradient === 'custom' && customColors.length > 0
			? `background: linear-gradient(135deg, ${customColors.join(', ')}); animation-duration: ${animationDuration};`
			: ''
	);

	const buttonClasses = $derived(
		cn(
			'animated-btn',
			gradientClasses[gradient],
			sizeClasses[size],
			radiusClasses[radius],
			loading && 'animated-btn-loading',
			disabled && 'animated-btn-disabled',
			className
		)
	);
</script>

{#if href}
	<a
		{href}
		class={buttonClasses}
		{onclick}
		aria-disabled={disabled}
		style={customGradientStyle}
		{...restProps}
	>
		{#if loading}
			<span class="animated-btn-spinner"></span>
		{/if}
		{@render children?.()}
	</a>
{:else}
	<button
		{type}
		{disabled}
		{name}
		{value}
		class={buttonClasses}
		{onclick}
		aria-disabled={disabled || loading}
		style={customGradientStyle}
		{...restProps}
	>
		{#if loading}
			<span class="animated-btn-spinner"></span>
		{/if}
		{@render children?.()}
	</button>
{/if}

<style>
	/* Base animated button styles */
	.animated-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		outline: none;
		border: none;
		text-decoration: none;
		white-space: nowrap;
		position: relative;
		overflow: hidden;
		background-size: 200% 200%;
		animation: gradientShift 3s ease infinite;
		transition: all 0.3s ease;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	.animated-btn:hover:not(.animated-btn-disabled) {
		transform: translateY(-2px);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
	}

	.animated-btn:active:not(.animated-btn-disabled) {
		transform: translateY(0);
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
	}

	.animated-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Size variants */
	.animated-btn-sm {
		height: 2.25rem;
		padding: 0 var(--spacing-md);
		font-size: var(--font-size-sm);
	}

	.animated-btn-md {
		height: 2.5rem;
		padding: 0 var(--spacing-lg);
		font-size: var(--font-size-md);
	}

	.animated-btn-lg {
		height: 2.75rem;
		padding: 0 var(--spacing-xl);
		font-size: var(--font-size-lg);
	}

	/* Border radius variants */
	.animated-btn-radius-none {
		border-radius: var(--border-radius-none);
	}

	.animated-btn-radius-sm {
		border-radius: var(--border-radius-sm);
	}

	.animated-btn-radius-md {
		border-radius: var(--border-radius-md);
	}

	.animated-btn-radius-lg {
		border-radius: var(--border-radius-lg);
	}

	.animated-btn-radius-xl {
		border-radius: var(--border-radius-xl);
	}

	.animated-btn-radius-2xl {
		border-radius: var(--border-radius-2xl);
	}

	.animated-btn-radius-full {
		border-radius: var(--border-radius-full);
	}

	/* Gradient variants */
	.gradient-cmy {
		background: linear-gradient(135deg, var(--cyan), var(--magenta), var(--yellow));
		background-size: 200% 200%;
		animation: gradientShift 3s ease infinite;
		transition: all 0.3s ease;
	}

	.gradient-primary {
		background: linear-gradient(
			135deg,
			var(--color-primary-light, var(--color-primary)),
			var(--color-primary),
			var(--color-primary-dark, var(--color-primary)),
			var(--color-primary-light, var(--color-primary))
		);
	}

	.gradient-secondary {
		background: linear-gradient(
			135deg,
			var(--color-secondary-light, var(--color-secondary)),
			var(--color-secondary),
			var(--color-secondary-dark, var(--color-secondary)),
			var(--color-secondary-light, var(--color-secondary))
		);
	}

	.gradient-accent {
		background: linear-gradient(
			135deg,
			var(--color-accent-light, var(--color-accent)),
			var(--color-accent),
			var(--color-accent-dark, var(--color-accent)),
			var(--color-accent-light, var(--color-accent))
		);
	}

	.gradient-success {
		background: linear-gradient(135deg, #4ade80, var(--color-success), #16a34a, #4ade80);
	}

	.gradient-warning {
		background: linear-gradient(135deg, #fbbf24, var(--color-warning), #d97706, #fbbf24);
	}

	.gradient-error {
		background: linear-gradient(135deg, #f87171, var(--color-error), #dc2626, #f87171);
	}

	/* .gradient-custom uses inline style for dynamic gradients */

	/* Hover effects with gradient-specific glows */
	.gradient-cmy:hover:not(.animated-btn-disabled) {
		transform: translateY(-2px);
		box-shadow: 0 10px 25px rgba(0, 255, 255, 0.4);
	}
	.gradient-primary:hover:not(.animated-btn-disabled) {
		box-shadow: 0 10px 25px rgba(var(--color-primary-rgb), 0.4);
	}

	.gradient-secondary:hover:not(.animated-btn-disabled) {
		box-shadow: 0 10px 25px rgba(var(--color-secondary-rgb), 0.4);
	}

	.gradient-success:hover:not(.animated-btn-disabled) {
		box-shadow: 0 10px 25px rgba(34, 197, 94, 0.4);
	}

	.gradient-warning:hover:not(.animated-btn-disabled) {
		box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4);
	}

	.gradient-error:hover:not(.animated-btn-disabled) {
		box-shadow: 0 10px 25px rgba(239, 68, 68, 0.4);
	}

	/* States */
	.animated-btn-disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
		animation: none;
	}

	.animated-btn-loading {
		opacity: 0.7;
		cursor: wait;
		animation-play-state: paused;
	}

	.animated-btn-spinner {
		width: 1rem;
		height: 1rem;
		margin-right: var(--spacing-sm);
		border: 2px solid currentColor;
		border-top-color: transparent;
		animation: spin 0.6s linear infinite;
	}

	/* Animations */
	@keyframes gradientShift {
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

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Accessibility - reduce motion */
	@media (prefers-reduced-motion: reduce) {
		.animated-btn {
			animation: none;
		}

		.animated-btn:hover {
			transform: none;
		}

		.animated-btn-spinner {
			animation: none;
		}
	}

	/* Dark mode adjustments */
	:global(.dark) .animated-btn {
		/* Slightly adjust text shadow for better contrast in dark mode */
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	}
</style>

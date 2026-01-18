<!-- src/lib/components/custom/Badge.svelte -->
<script lang="ts" module>
	import type { HTMLAttributes } from 'svelte/elements';

	export interface BadgeProps {
		variant?: 'default' | 'outlined' | 'filled' | 'ghost' | 'custom';
		size?: 'sm' | 'md' | 'lg';
		radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
		unstyled?: boolean;
		class?: string;
		pill?: boolean; // Convenience prop for full radius
		dot?: boolean; // Show a dot indicator
		dismissible?: boolean; // Show close button
		ondismiss?: () => void;
		interactive?: boolean; // Prevents text selection
		clickable?: boolean; // Makes badge clickable with pointer cursor
		onclick?: (event: MouseEvent) => void;
	}

	export type ThemedBadgeProps = BadgeProps &
		Omit<HTMLAttributes<HTMLSpanElement>, keyof BadgeProps>;
</script>

<script lang="ts">
	import { cn } from '@parallaxrealms/utils-core';

	let {
		variant = 'default',
		size = 'md',
		radius = 'full',
		unstyled = false,
		class: className = '',
		pill = false,
		dot = false,
		dismissible = false,
		ondismiss = () => {},
		interactive = true,
		clickable = false,
		onclick,
		children,
		...restProps
	} = $props<ThemedBadgeProps & { children?: any }>();

	const isCustom = $derived(variant === 'custom' || unstyled);

	// Override radius if pill is true
	const effectiveRadius = $derived(pill ? 'full' : radius);

	const variantClasses: Record<string, string> = {
		default: 'badge-default',
		outlined: 'badge-outlined',
		filled: 'badge-filled',
		ghost: 'badge-ghost',
		custom: ''
	};

	const sizeClasses: Record<string, string> = {
		sm: 'badge-sm',
		md: 'badge-md',
		lg: 'badge-lg'
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

	let badgeClasses = $derived(
		isCustom
			? cn('badge-base', className)
			: cn(
					'badge',
					variantClasses[variant],
					sizeClasses[size],
					radiusClasses[effectiveRadius],
					dot && 'badge-dot',
					dismissible && 'badge-dismissible',
					interactive && 'badge-interactive',
					clickable && 'badge-clickable',
					className
				)
	);

	let dotClasses = $derived(
		isCustom ? 'badge-dot-base' : cn('badge-dot-indicator', sizeClasses[size])
	);

	let dismissButtonClasses = $derived(
		isCustom ? 'badge-dismiss-base' : cn('badge-dismiss', sizeClasses[size])
	);
</script>

<span
	class={badgeClasses}
	{onclick}
	role={clickable ? 'button' : undefined}
	{...clickable ? { tabindex: 0 } : {}}
	onkeydown={(e) => {
		if (clickable && onclick && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			onclick(e);
		}
	}}
	{...restProps}
>
	{#if dot}
		<span class={dotClasses} aria-hidden="true"></span>
	{/if}
	{@render children?.()}
	{#if dismissible}
		<button
			type="button"
			class={dismissButtonClasses}
			onclick={(e) => {
				e.stopPropagation();
				ondismiss();
			}}
			aria-label="Dismiss badge"
		>
			<svg
				class={isCustom ? 'h-3 w-3' : 'badge-dismiss-icon'}
				fill="none"
				viewBox="0 0 14 14"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 4l6 6m0-6l-6 6" />
			</svg>
		</button>
	{/if}
</span>

<style>
	/* Base structural styles - always applied to custom variant */
	.badge-base {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		position: relative;
	}

	.badge-dot-base {
		display: inline-block;
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 50%;
		background-color: currentColor;
		flex-shrink: 0;
	}

	.badge-dismiss-base {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		margin-left: 0.25rem;
		flex-shrink: 0;
		color: currentColor;
		opacity: 0.7;
		transition: opacity 150ms ease-in-out;
	}

	.badge-dismiss-base:hover {
		opacity: 1;
	}

	/* Full badge styles - structural only */
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-weight: 600;
		line-height: 1;
		transition: all 150ms ease-in-out;
		position: relative;
		white-space: nowrap;
	}

	/* Size variants */
	.badge-sm {
		padding: 0.125rem 0.5rem;
		font-size: 0.75rem;
		min-height: 1.25rem;
	}

	.badge-md {
		padding: 0.25rem 0.75rem;
		font-size: 0.875rem;
		min-height: 1.5rem;
	}

	.badge-lg {
		padding: 0.375rem 1rem;
		font-size: 0.9375rem;
		min-height: 1.875rem;
	}

	/* Interactive states */
	.badge-interactive {
		cursor: default;
		user-select: none;
		-webkit-user-select: none;
	}

	.badge-clickable {
		cursor: pointer;
		user-select: none;
		-webkit-user-select: none;
		transition: all 150ms ease-in-out;
	}

	.badge-clickable:hover {
		transform: translateY(-1px);
	}

	.badge-clickable:active {
		transform: translateY(0);
	}

	.badge-clickable:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	/* Variant structures - no colors */
	.badge-default {
		border-width: 1px;
		border-style: solid;
	}

	.badge-outlined {
		background-color: transparent;
		border-width: 1px;
		border-style: solid;
	}

	.badge-filled {
		border: none;
	}

	.badge-ghost {
		background-color: transparent;
		border: none;
	}

	/* Dot indicator styles */
	.badge-dot {
		padding-left: calc(0.5rem + 0.5rem);
	}

	.badge-dot-indicator {
		display: inline-block;
		border-radius: 50%;
		background-color: currentColor;
		flex-shrink: 0;
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	.badge-sm .badge-dot-indicator {
		width: 0.375rem;
		height: 0.375rem;
	}

	.badge-md .badge-dot-indicator {
		width: 0.5rem;
		height: 0.5rem;
	}

	.badge-lg .badge-dot-indicator {
		width: 0.625rem;
		height: 0.625rem;
	}

	/* Dismiss button styles */
	.badge-dismissible {
		padding-right: 0.25rem;
	}

	.badge-dismiss {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.125rem;
		margin-left: 0.25rem;
		flex-shrink: 0;
		color: currentColor;
		opacity: 0.6;
		transition: opacity 150ms ease-in-out;
		border-radius: 0.25rem;
	}

	.badge-dismiss:hover {
		opacity: 1;
	}

	.badge-dismiss:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 1px;
		opacity: 1;
	}

	.badge-dismiss-icon,
	.badge-sm .badge-dismiss svg,
	.badge-md .badge-dismiss svg,
	.badge-lg .badge-dismiss svg {
		width: 0.75rem;
		height: 0.75rem;
	}

	.badge-sm .badge-dismiss svg {
		width: 0.625rem;
		height: 0.625rem;
	}

	.badge-lg .badge-dismiss svg {
		width: 0.875rem;
		height: 0.875rem;
	}

	/* Keyframes */
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Accessibility - reduce motion */
	@media (prefers-reduced-motion: reduce) {
		.badge,
		.badge-clickable {
			transition: none;
		}

		.badge-dot-indicator {
			animation: none;
		}

		.badge-dismiss {
			transition: none;
		}
	}
</style>

<!-- src/lib/components/custom/Alert.svelte -->
<script lang="ts" module>
	import type { HTMLAttributes } from 'svelte/elements';

	export interface AlertProps {
		variant?: 'default' | 'outlined' | 'filled' | 'ghost' | 'custom';
		size?: 'sm' | 'md' | 'lg';
		radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
		dismissible?: boolean;
		ondismiss?: () => void;
		icon?: boolean; // Space for an icon slot
		title?: string; // Optional title
		unstyled?: boolean;
		class?: string;
		titleClass?: string;
		contentClass?: string;
		iconClass?: string;
	}

	export type ThemedAlertProps = AlertProps &
		Omit<HTMLAttributes<HTMLDivElement>, keyof AlertProps>;
</script>

<script lang="ts">
	import { cn } from '@parallaxrealms/pxp-utils/core';
	import { slide } from 'svelte/transition';

	let {
		variant = 'default',
		size = 'md',
		radius = 'lg',
		dismissible = false,
		ondismiss,
		icon = false,
		title,
		unstyled = false,
		class: className = '',
		titleClass = '',
		contentClass = '',
		iconClass = '',
		children,
		iconSlot,
		titleSlot,
		...restProps
	} = $props<ThemedAlertProps & { children?: any; iconSlot?: any; titleSlot?: any }>();

	// Local state for dismissing
	let isVisible = $state(true);

	const isCustom = $derived(variant === 'custom' || unstyled);

	const variantClasses: Record<string, string> = {
		default: 'alert-default',
		outlined: 'alert-outlined',
		filled: 'alert-filled',
		ghost: 'alert-ghost',
		custom: ''
	};

	const sizeClasses: Record<string, string> = {
		sm: 'alert-sm',
		md: 'alert-md',
		lg: 'alert-lg'
	};

	const radiusClasses: Record<string, string> = {
		none: 'rounded-none',
		sm: 'rounded-sm',
		md: 'rounded-md',
		lg: 'rounded-lg',
		xl: 'rounded-xl',
		'2xl': 'rounded-2xl'
	};

	let alertClasses = $derived(
		isCustom
			? cn('alert-base', className)
			: cn(
					'alert',
					variantClasses[variant],
					sizeClasses[size],
					radiusClasses[radius],
					(icon || iconSlot) && 'alert-with-icon',
					dismissible && 'alert-dismissible',
					className
				)
	);

	let iconWrapperClasses = $derived(
		isCustom ? cn('alert-icon-base', iconClass) : cn('alert-icon', `alert-icon-${size}`, iconClass)
	);

	let titleClasses = $derived(
		isCustom
			? cn('alert-title-base', titleClass)
			: cn('alert-title', `alert-title-${size}`, titleClass)
	);

	let contentClasses = $derived(
		isCustom ? cn('alert-content-base', contentClass) : cn('alert-content', contentClass)
	);

	let dismissButtonClasses = $derived(
		isCustom ? 'alert-dismiss-base' : cn('alert-dismiss', `alert-dismiss-${size}`)
	);

	function handleDismiss() {
		isVisible = false;
		ondismiss?.();
	}
</script>

{#if isVisible}
	<div class={alertClasses} role="alert" transition:slide={{ duration: 200 }} {...restProps}>
		{#if icon || iconSlot}
			<div class={iconWrapperClasses}>
				{#if iconSlot}
					{@render iconSlot()}
				{/if}
			</div>
		{/if}

		<div class={isCustom ? 'alert-body-base' : 'alert-body'}>
			{#if title || titleSlot}
				<div class={titleClasses}>
					{#if titleSlot}
						{@render titleSlot()}
					{:else}
						{title}
					{/if}
				</div>
			{/if}

			<div class={contentClasses}>
				{@render children?.()}
			</div>
		</div>

		{#if dismissible}
			<button
				type="button"
				class={dismissButtonClasses}
				onclick={handleDismiss}
				aria-label="Dismiss alert"
			>
				<svg
					class={isCustom ? 'h-4 w-4' : 'alert-dismiss-icon'}
					fill="none"
					viewBox="0 0 14 14"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M1 1l12 12M13 1L1 13" />
				</svg>
			</button>
		{/if}
	</div>
{/if}

<style>
	/* Base structural styles - always applied to custom variant */
	.alert-base {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		width: 100%;
	}

	.alert-icon-base {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.alert-body-base {
		flex: 1;
		min-width: 0;
	}

	.alert-title-base {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.alert-content-base {
		display: block;
	}

	.alert-dismiss-base {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		color: currentColor;
		opacity: 0.5;
		transition: opacity 150ms ease-in-out;
	}

	.alert-dismiss-base:hover {
		opacity: 1;
	}

	/* Full alert styles - structural only */
	.alert {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		width: 100%;
		transition: all 150ms ease-in-out;
	}

	/* Size variants */
	.alert-sm {
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}

	.alert-md {
		padding: 0.75rem 1rem;
		font-size: 0.9375rem;
	}

	.alert-lg {
		padding: 1rem 1.25rem;
		font-size: 1rem;
	}

	/* Adjust padding when dismissible */
	.alert-dismissible {
		padding-right: 2.5rem;
	}

	/* Icon wrapper */
	.alert-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: currentColor;
	}

	.alert-icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.alert-icon-md {
		width: 1.25rem;
		height: 1.25rem;
	}

	.alert-icon-lg {
		width: 1.5rem;
		height: 1.5rem;
	}

	/* Body and content */
	.alert-body {
		flex: 1;
		min-width: 0;
	}

	.alert-title {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.alert-title-sm {
		font-size: 0.875rem;
	}

	.alert-title-md {
		font-size: 0.9375rem;
	}

	.alert-title-lg {
		font-size: 1rem;
	}

	.alert-content {
		line-height: 1.5;
	}

	/* Dismiss button */
	.alert-dismiss {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		color: currentColor;
		opacity: 0.6;
		transition: opacity 150ms ease-in-out;
		border-radius: 0.25rem;
	}

	.alert-dismiss:hover {
		opacity: 1;
	}

	.alert-dismiss:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
		opacity: 1;
	}

	.alert-dismiss-icon,
	.alert-dismiss-sm svg,
	.alert-dismiss-md svg,
	.alert-dismiss-lg svg {
		width: 1rem;
		height: 1rem;
	}

	.alert-dismiss-sm svg {
		width: 0.875rem;
		height: 0.875rem;
	}

	.alert-dismiss-lg svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	/* Variant structures - no colors */
	.alert-default {
		border-width: 1px;
		border-style: solid;
	}

	.alert-outlined {
		background-color: transparent;
		border-width: 2px;
		border-style: solid;
	}

	.alert-filled {
		border: none;
	}

	.alert-ghost {
		background-color: transparent;
		border: none;
		padding-left: 0;
		padding-right: 0;
	}

	.alert-ghost.alert-dismissible {
		padding-right: 2.5rem;
	}

	/* Accessibility - reduce motion */
	@media (prefers-reduced-motion: reduce) {
		.alert {
			transition: none;
		}

		.alert-dismiss {
			transition: none;
		}
	}
</style>

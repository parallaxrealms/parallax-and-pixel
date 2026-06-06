<!-- src/lib/components/custom/Button.svelte -->
<script lang="ts" module>
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

	export interface ButtonProps {
		variant?: 'default' | 'outlined' | 'ghost' | 'darkmode' | 'custom';
		size?: 'sm' | 'md' | 'lg' | 'icon';
		radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		unstyled?: boolean;
		class?: string;
		onclick?: (event: MouseEvent) => void;
		ariaPressed?: any;
		name?: string;
		value?: string;
		checked?: boolean; // For darkmode variant
	}

	export type ThemedButtonProps = ButtonProps & Omit<HTMLButtonAttributes, keyof ButtonProps>;
	export type LinkButtonProps = ButtonProps & Omit<HTMLAnchorAttributes, keyof ButtonProps>;
</script>

<script lang="ts">
	import { cn } from '@parallaxrealms/pxp-utils/core';

	let {
		variant = 'default',
		size = 'md',
		radius = 'md',
		href,
		type = 'button',
		disabled = false,
		loading = false,
		unstyled = false,
		class: className = '',
		onclick = () => {},
		ariaPressed,
		name,
		value,
		checked = false,
		children,
		...restProps
	} = $props<(ThemedButtonProps | LinkButtonProps) & { children?: any; checked?: boolean }>();

	const isCustom = $derived(variant === 'custom' || unstyled);
	const isDarkMode = $derived(variant === 'darkmode');

	const variantClasses: Record<string, string> = {
		default: 'btn-default',
		outlined: 'btn-outlined',
		ghost: 'btn-ghost',
		darkmode: 'btn-darkmode',
		custom: ''
	};

	const sizeClasses: Record<string, string> = {
		sm: 'btn-sm',
		md: 'btn-md',
		lg: 'btn-lg',
		icon: 'btn-icon'
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

	let buttonClasses = $derived(
		isCustom
			? cn('btn-base', className)
			: cn(
					'btn',
					variantClasses[variant],
					!isDarkMode && sizeClasses[size],
					!isDarkMode && radiusClasses[radius],
					disabled && 'btn-disabled',
					loading && 'btn-loading',
					isDarkMode && checked && 'btn-darkmode-checked',
					className
				)
	);
</script>

{#if href && !disabled}
	<a {href} class={buttonClasses} aria-disabled={disabled || loading} {ariaPressed} {...restProps}>
		{#if loading}
			<span class={isCustom ? 'spinner' : 'btn-spinner'}></span>
		{:else if isDarkMode}
			<svg class="sun-and-moon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
				<mask class="moon" id="moon-mask">
					<rect x="0" y="0" width="100%" height="100%" fill="white" />
					<circle cx="24" cy="10" r="6" fill="black" />
				</mask>
				<circle class="sun" cx="12" cy="12" r="6" mask="url(#moon-mask)" fill="currentColor" />
				<g class="sun-beams" stroke="currentColor">
					<line x1="12" y1="1" x2="12" y2="3" />
					<line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" />
					<line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</g>
			</svg>
		{/if}
		{#if !isDarkMode}
			{@render children?.()}
		{/if}
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
		{ariaPressed}
		{...restProps}
	>
		{#if loading}
			<span class={isCustom ? 'spinner' : 'btn-spinner'}></span>
		{:else if isDarkMode}
			<svg class="sun-and-moon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
				<mask class="moon" id="moon-mask">
					<rect x="0" y="0" width="100%" height="100%" fill="white" />
					<circle cx="24" cy="10" r="6" fill="black" />
				</mask>
				<circle class="sun" cx="12" cy="12" r="6" mask="url(#moon-mask)" fill="currentColor" />
				<g class="sun-beams" stroke="currentColor">
					<line x1="12" y1="1" x2="12" y2="3" />
					<line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" />
					<line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</g>
			</svg>
		{/if}
		{#if !isDarkMode}
			{@render children?.()}
		{/if}
	</button>
{/if}

<style>
	/* Base structural styles - always applied to custom variant */
	.btn-base {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		text-decoration: none;
		position: relative;
	}

	.btn-base:disabled,
	.btn-base[aria-disabled='true'] {
		cursor: not-allowed;
		pointer-events: none;
	}

	/* Simple spinner for custom variant */
	.spinner {
		width: 1rem;
		height: 1rem;
		margin-right: 0.5rem;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	/* Core button styles - structural only */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 500;
		transition: all 150ms ease-in-out;
		cursor: pointer;
		outline: none;
		text-decoration: none;
		white-space: nowrap;
		position: relative;
		overflow: hidden;
	}

	.btn:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	/* Size variants - just sizing, no colors */
	.btn-sm {
		height: 2rem;
		padding: 0 0.75rem;
		font-size: 0.875rem;
	}

	.btn-md {
		height: 2.5rem;
		padding: 0 1rem;
		font-size: 0.9375rem;
	}

	.btn-lg {
		height: 3rem;
		padding: 0 1.5rem;
		font-size: 1rem;
	}

	.btn-icon {
		height: 2.5rem;
		width: 2.5rem;
		padding: 0;
	}

	/* Default variant - just adds border, no colors */
	.btn-default {
		border-width: 1px;
		border-style: solid;
	}

	/* Outlined variant - just border structure */
	.btn-outlined {
		background-color: transparent;
		border-width: 2px;
		border-style: solid;
	}

	/* Ghost variant - minimal structure */
	.btn-ghost {
		background-color: transparent;
		border: 1px solid transparent;
	}

	/* Loading state */
	.btn-loading {
		opacity: 0.7;
		cursor: wait;
	}

	.btn-spinner {
		width: 1rem;
		height: 1rem;
		margin-right: 0.5rem;
		border: 2px solid currentColor;
		border-top-color: transparent;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Disabled state */
	.btn-disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}

	/* DarkMode Variant - keeps its own styling */
	.btn-darkmode {
		background: none;
		border: none;
		cursor: pointer;
		padding: 8px;
		border-radius: 50%;
		border: 2px solid transparent;
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		width: auto;
		height: auto;
		color: rgb(51 65 85);
	}

	.btn-darkmode:hover {
		background-color: rgba(0, 0, 0, 0.05);
		border-color: rgb(148 163 184);
	}

	:global(.dark) .btn-darkmode {
		color: rgb(226 232 240);
	}

	:global(.dark) .btn-darkmode:hover {
		background-color: rgba(255, 255, 255, 0.1);
		border-color: rgb(100 116 139);
	}

	.sun-and-moon > :is(.moon, .sun, .sun-beams) {
		transform-origin: center;
	}

	.sun-and-moon > :is(.moon, .sun) {
		fill: currentColor;
	}

	.btn-darkmode:is(:hover, :focus-visible) > .sun-and-moon > :is(.moon, .sun) {
		fill: currentColor;
	}

	.sun-and-moon > .sun-beams {
		stroke: currentColor;
		stroke-width: 2px;
	}

	.btn-darkmode:is(:hover, :focus-visible) .sun-and-moon > .sun-beams {
		stroke: currentColor;
	}

	/* Dark mode animations */
	:global(.dark) .sun-and-moon > .sun {
		transform: scale(1.75);
	}

	:global(.dark) .sun-and-moon > .sun-beams {
		opacity: 0;
	}

	:global(.dark) .sun-and-moon > .moon > circle {
		transform: translateX(-7px);
	}

	@supports (cx: 1) {
		:global(.dark) .sun-and-moon > .moon > circle {
			cx: 17;
			transform: translateX(0);
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.sun-and-moon > .sun {
			transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
		}

		.sun-and-moon > .sun-beams {
			transition:
				transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55),
				opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
		}

		.sun-and-moon .moon > circle {
			transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		}

		@supports (cx: 1) {
			.sun-and-moon .moon > circle {
				transition: cx 0.25s cubic-bezier(0.4, 0, 0.2, 1);
			}
		}

		:global(.dark) .sun-and-moon > .sun {
			transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
			transition-duration: 0.25s;
		}

		:global(.dark) .sun-and-moon > .sun-beams {
			transition-duration: 0.15s;
			transform: rotateZ(-25deg);
		}

		:global(.dark) .sun-and-moon > .moon > circle {
			transition-duration: 0.5s;
			transition-delay: 0.25s;
		}
	}

	/* Reduce motion */
	@media (prefers-reduced-motion: reduce) {
		.btn,
		.sun-and-moon > * {
			transition: none;
			animation: none;
		}
	}
</style>

<script lang="ts" module>
	import type { HTMLInputAttributes } from 'svelte/elements';

	export interface ThemedInputProps {
		variant?: 'default' | 'filled' | 'outlined' | 'custom';
		size?: 'sm' | 'md' | 'lg';
		unstyled?: boolean;
		class?: string;
	}

	// Merge with native input attributes
	export type InputProps = ThemedInputProps & Omit<HTMLInputAttributes, keyof ThemedInputProps>;
</script>

<script lang="ts">
	import { cn } from '@parallaxrealms/pxp-utils/core';

	let {
		variant = '',
		size = '',
		unstyled = false,
		class: className = '',
		type = 'text',
		value = $bindable(),
		files = $bindable(),
		...restProps
	} = $props<InputProps & { children?: any }>();

	const isCustom = $derived(variant === 'custom' || unstyled);

	const sizeClasses: Record<string, string> = {
		sm: 'input-sm',
		md: 'input-md',
		lg: 'input-lg'
	};

	const variantClasses: Record<string, string> = {
		default: 'input-default',
		filled: 'input-filled',
		outlined: 'input-outlined',
		custom: ''
	};

	let inputClasses = $derived(
		isCustom
			? cn('input-base', className)
			: cn('input', variantClasses[variant], sizeClasses[size], className)
	);
</script>

{#if type === 'file'}
	<!-- File input -->
	<input type="file" class={inputClasses} bind:files {...restProps} />
{:else}
	<!-- All other inputs -->
	<input {type} class={inputClasses} bind:value {...restProps} />
{/if}

<style>
	/* Structural base */
	.input-base {
		width: 100%;
		font-family: inherit;
		box-sizing: border-box;
		border-radius: var(--border-radius-md);
		transition: all var(--transition-normal);
	}

	/* Full themed */
	.input {
		width: 100%;
		color: var(--color-text);
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		outline: none;
		line-height: var(--line-height-normal);
	}

	/* Sizes */
	.input-sm {
		height: 2.25rem;
		padding: 0 var(--spacing-sm);
		font-size: var(--font-size-sm);
	}

	.input-md {
		height: 2.5rem;
		padding: 0 var(--spacing-md);
		font-size: var(--font-size-md);
	}

	.input-lg {
		height: 2.75rem;
		padding: 0 var(--spacing-lg);
		font-size: var(--font-size-lg);
	}

	/* Variants */
	.input-default {
		background-color: var(--color-surface);
	}

	.input-filled {
		background-color: var(--color-surface-hover);
		border-color: var(--color-border-hover);
	}

	.input-outlined {
		background-color: transparent;
		border: 2px solid var(--color-border);
	}

	/* States */
	.input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
	}

	.input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>

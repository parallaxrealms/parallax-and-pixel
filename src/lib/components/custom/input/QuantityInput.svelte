<!-- src/lib/components/custom/QuantityInput.svelte -->
<script lang="ts">
	import { Minus, Plus } from 'lucide-svelte';
	import { cn } from '@parallaxrealms/utils-core';

	interface Props {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		variant?: 'default' | 'compact' | 'inline' | 'custom';
		size?: 'sm' | 'md' | 'lg';
		label?: string;
		placeholder?: string;
		class?: string;
		onChange?: (value: number) => void;
		onBlur?: () => void;
	}

	let {
		value = $bindable(),
		min = 0,
		max = 999,
		step = 1,
		disabled = false,
		variant = 'default',
		size = 'md',
		label = '',
		placeholder = '0',
		class: className = '',
		onChange = () => {},
		onBlur = () => {}
	}: Props = $props();

	let inputRef = $state<HTMLInputElement>();
	let isFocused = $state(false);

	// Handle increment
	function increment() {
		if (disabled) return;
		const newValue = Math.min(max, (value || 0) + step);
		value = newValue;
		onChange(newValue);
	}

	// Handle decrement
	function decrement() {
		if (disabled) return;
		const newValue = Math.max(min, (value || 0) - step);
		value = newValue;
		onChange(newValue);
	}

	// Handle direct input
	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const inputValue = target.value;

		// Allow empty input while typing
		if (inputValue === '') {
			value = 0;
			return;
		}

		// Parse and validate
		const parsed = parseInt(inputValue, 10);
		if (!isNaN(parsed)) {
			value = Math.max(min, Math.min(max, parsed));
			onChange(value);
		} else {
			// Reset to previous valid value
			target.value = value?.toString() || '0';
		}
	}

	// Handle keyboard shortcuts
	function handleKeyDown(e: KeyboardEvent) {
		if (disabled) return;

		switch (e.key) {
			case 'ArrowUp':
				e.preventDefault();
				increment();
				break;
			case 'ArrowDown':
				e.preventDefault();
				decrement();
				break;
			case 'Enter':
				e.preventDefault();
				inputRef?.blur();
				break;
		}
	}

	// Format display value
	let displayValue = $derived(value?.toString() || '0');

	// Size classes
	const sizeClasses = {
		sm: {
			container: 'h-8',
			input: 'text-sm px-2',
			button: 'w-8 h-8',
			icon: 'h-3 w-3'
		},
		md: {
			container: 'h-10',
			input: 'text-base px-3',
			button: 'w-10 h-10',
			icon: 'h-4 w-4'
		},
		lg: {
			container: 'h-12',
			input: 'text-lg px-4',
			button: 'w-12 h-12',
			icon: 'h-5 w-5'
		}
	};

	const currentSize = $derived(sizeClasses[size]);

	// Variant classes
	const variantClasses = {
		default: 'quantity-input-default',
		compact: 'quantity-input-compact',
		inline: 'quantity-input-inline',
		custom: ''
	};

	const containerClass = $derived(
		cn(
			'quantity-input',
			variantClasses[variant],
			currentSize.container,
			{
				'opacity-50 pointer-events-none': disabled,
				focused: isFocused
			},
			className
		)
	);
</script>

{#if label && variant !== 'inline'}
	<label for="inline-quantity-label" class="quantity-label">{label}</label>
{/if}

<div class={containerClass}>
	{#if variant === 'inline' && label}
		<span class="inline-label">{label}</span>
	{/if}

	<button
		type="button"
		class="quantity-button decrement {currentSize.button}"
		onclick={decrement}
		disabled={disabled || value <= min}
		aria-label="Decrease quantity"
	>
		<Minus class={currentSize.icon} />
	</button>

	<input
		bind:this={inputRef}
		type="text"
		inputmode="numeric"
		pattern="[0-9]*"
		value={displayValue}
		{placeholder}
		{disabled}
		class="quantity-value {currentSize.input}"
		oninput={handleInput}
		onkeydown={handleKeyDown}
		onfocus={() => (isFocused = true)}
		onblur={() => {
			isFocused = false;
			onBlur();
		}}
		aria-label={label || 'Quantity'}
	/>

	<button
		type="button"
		class="quantity-button increment {currentSize.button}"
		onclick={increment}
		disabled={disabled || value >= max}
		aria-label="Increase quantity"
	>
		<Plus class={currentSize.icon} />
	</button>
</div>

<style>
	.quantity-label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
	}

	.quantity-input {
		display: flex;
		align-items: center;
		position: relative;
		width: fit-content;
		max-width: 8rem;
		border-radius: var(--border-radius-md);
		transition: all var(--transition-normal);
	}

	/* Default variant */
	.quantity-input-default {
		border: 2px solid var(--color-border);
		background: var(--color-surface);
		overflow: hidden;
	}

	.quantity-input-default:hover:not(.opacity-50) {
		border-color: var(--color-primary);
	}

	.quantity-input-default.focused {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
	}

	.quantity-input-default .quantity-button {
		background: transparent;
		color: var(--color-text-muted);
		transition: all var(--transition-fast);
	}

	.quantity-input-default .quantity-button:not(:disabled):hover {
		background: var(--color-surface);
		color: var(--color-primary);
	}

	.quantity-input-default .quantity-value {
		background: transparent;
		border-left: 1px solid var(--color-border);
		border-right: 1px solid var(--color-border);
	}

	/* Compact variant */
	.quantity-input-compact {
		border: 1px solid var(--color-border);
		background: var(--color-background);
		overflow: hidden;
	}

	.quantity-input-compact:hover:not(.opacity-50) {
		border-color: var(--color-primary);
	}

	.quantity-input-compact.focused {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.1);
	}

	.quantity-input-compact .quantity-button {
		background: var(--color-surface);
		color: var(--color-text-muted);
		transition: all var(--transition-fast);
	}

	.quantity-input-compact .quantity-button:not(:disabled):hover {
		background: var(--color-primary-dark);
		color: white;
	}

	.quantity-input-compact .quantity-value {
		background: var(--color-surface);
		border: none;
		min-width: 2rem;
	}

	/* Inline variant */
	.quantity-input-inline {
		border: none;
		background: transparent;
		gap: 0.25rem;
		overflow: visible;
	}

	.inline-label {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-right: 0.5rem;
		white-space: nowrap;
	}

	.quantity-input-inline .quantity-button {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		border-radius: var(--border-radius-sm);
		transition: all var(--transition-fast);
	}

	.quantity-input-inline .quantity-button:not(:disabled):hover {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
		transform: scale(1.05);
	}

	.quantity-input-inline .quantity-value {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-sm);
		min-width: 4rem;
		transition: all var(--transition-fast);
	}

	.quantity-input-inline .quantity-value:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.1);
	}

	/* Common button styles */
	.quantity-button {
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		cursor: pointer;
		transition: all var(--transition-normal);
		flex-shrink: 0;
		background: transparent;
	}

	.quantity-button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.quantity-button:active:not(:disabled) {
		transform: scale(0.95);
	}

	.quantity-button.decrement {
		border-radius: var(--border-radius-md) 0 0 var(--border-radius-md);
	}

	.quantity-button.increment {
		border-radius: 0 var(--border-radius-md) var(--border-radius-md) 0;
	}

	/* Input styles */
	.quantity-value {
		border: none;
		text-align: center;
		font-weight: 600;
		color: var(--color-primary);
		min-width: 2.5rem;
		width: 3rem;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
		outline: none;
		background: transparent;
		transition: all var(--transition-fast);
		height: 100%;
	}

	.quantity-value:focus {
		outline: none;
	}

	/* Remove spinner arrows (for numeric keyboard support) */
	.quantity-value::-webkit-outer-spin-button,
	.quantity-value::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	/* Dark mode adjustments */
	:global(.dark) .quantity-input-default {
		background: var(--color-surface);
		border-color: var(--color-surface-primary);
	}

	:global(.dark) .quantity-input-default:hover:not(.opacity-50) {
		border-color: var(--color-primary);
	}

	:global(.dark) .quantity-input-default .quantity-value {
		background: var(--color-surface);
		border-color: var(--color-surface-hover);
		color: var(--color-text);
	}

	:global(.dark) .quantity-input-default .quantity-button {
		color: var(--color-text-muted);
	}

	:global(.dark) .quantity-input-compact {
		background: var(--color-surface);
		border-color: var(--color-surface-hover);
	}

	:global(.dark) .quantity-input-compact .quantity-button {
		background: var(--color-surface-hover);
		color: var(--color-primary);
	}

	:global(.dark) .quantity-input-compact .quantity-value {
		background: var(--color-surface);
		color: var(--color-text);
	}

	:global(.dark) .quantity-input-inline .quantity-button {
		background: var(--color-surface);
		border-color: var(--color-surface-hover);
		color: var(--color-text-muted);
	}

	:global(.dark) .quantity-input-inline .quantity-value {
		background: var(--color-surface);
		border-color: var(--color-surface-hover);
		color: var(--color-text);
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.quantity-value {
			min-width: 2rem;
		}

		.quantity-input-inline .quantity-value {
			min-width: 2.5rem;
		}
	}

	/* Hover effects for better UX */
	@media (hover: hover) {
		.quantity-button:not(:disabled):hover {
			transition-duration: var(--transition-fast);
		}
	}

	/* Focus visible for accessibility */
	.quantity-button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.quantity-value:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}
</style>

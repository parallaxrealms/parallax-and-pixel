<!-- src/lib/components/ui/GradientText.svelte -->
<script lang="ts" module>
	export interface GradientTextProps {
		text?: string;
		variant?: 'default' | 'dark' | 'light' | 'custom';
		size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
		class?: string;
		lightColors?: string[];
		darkColors?: string[];
		animation?: boolean;
		animationDuration?: number;
		[key: string]: any;
	}
</script>

<script lang="ts">
	import { cn } from '@parallaxrealms/utils-core';

	let {
		text = '',
		variant = 'default',
		size = '4xl',
		class: className = '',
		lightColors = ['#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4'],
		darkColors = ['#00a5cf', '#9fffcb', '#25a18e'],
		animation = true,
		animationDuration = 4,
		...restProps
	} = $props();

	// Always dark mode
	const isDark = true;

	// Validate color arrays
	const validatedLightColors = $derived(
		lightColors.slice(0, 5).filter((color: string) => /^#[0-9A-Fa-f]{6}$/.test(color))
	);
	const validatedDarkColors = $derived(
		darkColors.slice(0, 5).filter((color: string) => /^#[0-9A-Fa-f]{6}$/.test(color))
	);

	// Ensure we have at least 2 colors
	const finalLightColors = $derived(
		validatedLightColors.length >= 2 ? validatedLightColors : ['#9c27b0', '#673ab7']
	);
	const finalDarkColors = $derived(
		validatedDarkColors.length >= 2 ? validatedDarkColors : ['#00ffff', '#ff00ff']
	);

	// Size classes mapping
	const sizeClasses: Record<string, string> = {
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-lg',
		xl: 'text-xl',
		'2xl': 'text-2xl',
		'3xl': 'text-3xl',
		'4xl': 'text-4xl',
		'5xl': 'text-5xl',
		'6xl': 'text-6xl'
	};

	// Generate gradient based on variant and mode
	const gradientStyle = $derived(() => {
		if (variant === 'custom') {
			// Custom variant: use provided colors based on current mode
			const colors = !isDark ? finalLightColors : finalDarkColors;
			return `linear-gradient(135deg, ${colors.join(', ')})`;
		}

		if (variant === 'light') {
			// Light variant: always use light colors regardless of mode
			return 'linear-gradient(135deg, #9c27b0, #673ab7, #3f51b5, #2196f3, #00bcd4)';
		}

		if (variant === 'dark') {
			// Dark variant: always use dark colors regardless of mode
			return 'linear-gradient(135deg, var(--cyan), var(--magenta), var(--yellow))';
		}

		// Default variant: automatically switch based on current mode
		if (!isDark) {
			return 'linear-gradient(135deg, #9c27b0, #673ab7, #3f51b5, #2196f3, #00bcd4)';
		} else {
			return 'linear-gradient(135deg, var(--cyan), var(--magenta), var(--yellow))';
		}
	});

	// Combined classes
	const combinedClasses = $derived(
		cn('gradient-text', sizeClasses[size], animation && 'gradient-text-animated', className)
	);
</script>

<h2
	class={combinedClasses}
	style="--gradient: {gradientStyle()}; --animation-duration: {animationDuration}s; {animation
		? '--animation-play-state: running;'
		: ''}"
	{...restProps}
>
	{text}
</h2>

<style>
	/* ------------------
   Base
------------------ */
	.gradient-text {
		background: var(--gradient);
		background-size: 200% 200%;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		padding-bottom: 0.1em;
		line-height: 1.2 !important;
		display: inline-block;
	}

	/* ------------------
   Animation
------------------ */
	.gradient-text-animated {
		animation: gradientShift var(--animation-duration, 4s) ease infinite;
	}

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

	/* Dark mode colors are handled via JavaScript gradient computation */
</style>

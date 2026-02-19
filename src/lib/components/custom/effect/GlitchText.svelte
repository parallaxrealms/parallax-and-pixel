<script lang="ts" module>
	export interface GlitchTextProps {
		text: string;
		tag?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
		chars?: string;
		glitchInterval?: number;
		glitchIntervalVariance?: number;
		glitchChance?: number;
		highlightChance?: number;
		highlightColor?: string;
		proximityMode?: boolean;
		proximityRadius?: number;
		proximityBoost?: number;
		class?: string;
	}
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';

	interface CharState {
		char: string;
		highlighted: boolean;
		original: string;
	}

	let {
		text,
		tag = 'span',
		chars = '!@#$%^&*():{};|,.<>/?',
		glitchInterval = 200,
		glitchIntervalVariance = 100,
		glitchChance = 0.05,
		highlightChance = 0.2,
		highlightColor = '#00a5cf',
		proximityMode = false,
		proximityRadius = 100,
		proximityBoost = 3,
		class: className = '',
		...restProps
	}: GlitchTextProps = $props();

	let charStates = $state<CharState[]>([]);
	let timeoutRef: ReturnType<typeof setTimeout> | null = null;
	let containerRef = $state<HTMLElement | null>(null);
	let charRefs = $state<(HTMLSpanElement | null)[]>([]);
	let mouseX = $state(0);
	let mouseY = $state(0);

	// Sync charStates and charRefs when text changes
	$effect(() => {
		charStates = text.split('').map((c) => ({ char: c, original: c, highlighted: false }));
		charRefs = new Array(text.length).fill(null);
	});

	function getRandomInterval() {
		return glitchInterval + Math.random() * glitchIntervalVariance;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!containerRef) return;
		const rect = containerRef.getBoundingClientRect();
		mouseX = e.clientX - rect.left;
		mouseY = e.clientY - rect.top;
	}

	function getProximityMultiplier(charIndex: number): number {
		if (!proximityMode || !containerRef) return 1;

		const charEl = charRefs[charIndex];
		if (!charEl) return 1;

		const containerRect = containerRef.getBoundingClientRect();
		const charRect = charEl.getBoundingClientRect();

		// Get character center position relative to container
		const charCenterX = charRect.left - containerRect.left + charRect.width / 2;
		const charCenterY = charRect.top - containerRect.top + charRect.height / 2;

		// Calculate distance from mouse to character center
		const distance = Math.sqrt(
			Math.pow(mouseX - charCenterX, 2) + Math.pow(mouseY - charCenterY, 2)
		);

		// Outside radius = low base glitch (0.2x)
		if (distance > proximityRadius) return 0.2;

		// Inside radius = boosted glitch (linear falloff from boost to 1)
		const normalizedDistance = distance / proximityRadius;
		return proximityBoost - (proximityBoost - 1) * normalizedDistance;
	}

	function glitchTick() {
		charStates = text.split('').map((char, index) => {
			if (char === ' ') return { char: ' ', original: ' ', highlighted: false };

			const multiplier = getProximityMultiplier(index);
			const effectiveGlitchChance = glitchChance * multiplier;
			const effectiveHighlightChance = highlightChance * multiplier;

			if (Math.random() < effectiveGlitchChance) {
				const glitchedChar = chars[Math.floor(Math.random() * chars.length)];
				const isHighlighted = Math.random() < effectiveHighlightChance;
				return { char: glitchedChar, original: char, highlighted: isHighlighted };
			}
			return { char, original: char, highlighted: false };
		});

		timeoutRef = setTimeout(glitchTick, getRandomInterval());
	}

	function startGlitch() {
		if (timeoutRef) return;
		glitchTick();
	}

	function stopGlitch() {
		if (timeoutRef) {
			clearTimeout(timeoutRef);
			timeoutRef = null;
		}
		charStates = text.split('').map((c) => ({ char: c, original: c, highlighted: false }));
	}

	onDestroy(() => {
		if (timeoutRef) clearTimeout(timeoutRef);
	});
</script>

<svelte:element
	this={tag}
	bind:this={containerRef}
	class={className}
	onmouseenter={startGlitch}
	onmouseleave={stopGlitch}
	onmousemove={handleMouseMove}
	{...restProps}
>{#each charStates as { char, highlighted }, i (i)}{#if char === ' '}{' '}{:else}<span
			bind:this={charRefs[i]}
			style={highlighted ? `color: ${highlightColor}` : undefined}>{char}</span>{/if}{/each}</svelte:element>

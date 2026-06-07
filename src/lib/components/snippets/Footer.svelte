<script lang="ts">
	import { getRandomQuote } from '$lib/utils/quotes';
	import GlitchText from '$lib/components/custom/effect/GlitchText.svelte';

	// Random quote for ticker (changes each animation cycle)
	let tickerQuote = $state(getRandomQuote());
	const copyrightText = `© ${new Date().getFullYear()} parallax and pixel. All rights reserved.`;

	function onTickerCycle() {
		tickerQuote = getRandomQuote();
	}
</script>

<footer class="border-t border-slate-800 bg-slate-900/50">
	<div class="flex items-center px-6 py-3">
		<!-- Copyright (left) -->
		<GlitchText
			text={copyrightText}
			tag="p"
			proximityMode={true}
			proximityRadius={30}
			proximityBoost={25}
			class="shrink-0 text-xs text-slate-400"
		/>

		<!-- Scrolling Quote Ticker (right, fills remaining space) -->
		<div class="ticker-container ml-6 flex-1 overflow-hidden">
			<span
				class="ticker-text text-xs text-slate-300"
				onanimationiteration={onTickerCycle}
			>
				"{tickerQuote}"
			</span>
		</div>
	</div>
</footer>

<style>
	/* Ticker Animation */
	.ticker-container {
		width: 100%;
	}

	.ticker-text {
		display: inline-block;
		white-space: nowrap;
		padding-left: 100%;
		animation: scroll-left 35s linear infinite;
	}

	@keyframes scroll-left {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-100%);
		}
	}
</style>

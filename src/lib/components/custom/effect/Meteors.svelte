<script lang="ts">
	import { onMount } from 'svelte';

	export let number = 50;

	type Meteor = {
		top: number;
		left: number;
		delay: number;
		dur: number;
		hue: number;
	};

	let meteors: Meteor[] = [];

	function spawn() {
		const w = window.innerWidth;

		meteors = Array.from({ length: number }).map(() => ({
			top: -10,
			left: Math.random() * w,
			delay: +(Math.random() * 4 + 0.1).toFixed(2),
			dur: +(Math.random() * 30 + 2.4).toFixed(2),
			hue: Math.floor(Math.random() * 360)
		}));
	}

	onMount(() => {
		spawn();
		window.addEventListener('resize', spawn);
	});
</script>

<div class="pointer-events-none fixed inset-0 overflow-hidden">
	{#each meteors as m}
		<span
			class="animate-meteor absolute rotate-[240deg] rounded-full"
			style="
				top:{m.top}px;
				left:{m.left}px;
				width:2px;
				height:2px;
				background:hsl({m.hue} 100% 70%);
				box-shadow:0 0 0 1px hsl({m.hue} 100% 70% / .2);
				animation-delay:{m.delay}s;
				animation-duration:{m.dur}s;"
		>
			<div
				class="absolute top-1/2 -z-10 -translate-y-1/2"
				style="
					width:140px;
					height:1px;
					background:linear-gradient(
						90deg,
						hsla({m.hue},100%,70%,1)   0%,
						hsla({m.hue},100%,70%,.3) 60%,
						hsla({m.hue},100%,70%,0)  100%
					);"
			></div>
		</span>
	{/each}
</div>

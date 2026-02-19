<!--
  Variant 1: Terminal Dossier
  CSS scanline rain background, single-column centered, CRT aesthetic
-->
<script lang="ts">
	import { skills, bio, avatarSrc } from './aboutData';
</script>

<section class="terminal-section relative min-h-screen overflow-hidden bg-black">
	<!-- Scanline rain - translating overlay for visible movement -->
	<div aria-hidden="true" class="scanline-rain-track">
		<div class="scanline-rain"></div>
	</div>
	<!-- Radial vignette -->
	<div aria-hidden="true" class="vignette"></div>

	<div class="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-24">
		<!-- CRT frame -->
		<div class="crt-frame w-full border border-cyan-800/40 p-8 md:p-12">
			<!-- Avatar -->
			<div class="mb-8 flex justify-center">
				<div class="avatar-ring h-32 w-32 overflow-hidden rounded-full">
					<img src={avatarSrc} alt="Portrait" loading="lazy" width="128" height="128" class="h-full w-full object-cover" />
				</div>
			</div>

			<!-- Prompt -->
			<div class="mb-6 font-terminal text-sm term-green">
				<span class="text-slate-500">parallax@dev:~$</span> cat about_me.txt<span class="cursor-blink">_</span>
			</div>

			<!-- Heading -->
			<h2 class="mb-8 text-center font-terminal text-3xl font-bold term-green md:text-4xl">
				About Me
			</h2>

			<!-- Bio as terminal output -->
			<div class="mb-8 space-y-4 font-terminal text-base leading-relaxed text-slate-300">
				<p>
					<span class="text-slate-500">&gt;</span>
					{bio.paragraph1Before}<a href={bio.paragraph1LinkHref} class="font-terminal text-slate-400 transition-colors hover:text-accent-highlight">{bio.paragraph1LinkText}</a>{bio.paragraph1After}
				</p>
				<p>
					<span class="text-slate-500">&gt;</span>
					{bio.paragraph2}
				</p>
			</div>

			<!-- Divider -->
			<div class="divider-line mb-8"></div>

			<!-- Skills as directory listings -->
			<div class="space-y-6">
				{#each skills as skill (skill.category)}
					<div>
						<div class="mb-2 font-terminal text-sm text-slate-500">
							parallax@dev:~$ ls skills/{skill.category.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-')}/
						</div>
						<div class="flex flex-wrap gap-x-6 gap-y-1 pl-4 font-terminal text-sm term-green-dim">
							{#each skill.items as item (item)}
								<span>{item}</span>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<!-- Footer prompt -->
			<div class="mt-8 font-terminal text-sm text-slate-500">
				parallax@dev:~$ <span class="cursor-blink term-green">_</span>
			</div>
		</div>
	</div>
</section>

<style>
	@reference "../../../../app.css";

	.term-green {
		color: #9bffcb;
	}

	.term-green-dim {
		color: rgba(155, 255, 203, 0.75);
	}

	.scanline-rain-track {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.scanline-rain {
		position: absolute;
		left: 0;
		right: 0;
		top: -50%;
		height: 200%;
		background: repeating-linear-gradient(
			0deg,
			transparent 0px,
			transparent 4px,
			rgba(155, 255, 203, 0.07) 4px,
			rgba(155, 255, 203, 0.07) 5px
		);
		animation: scanRain 40s linear infinite;
	}

	@keyframes scanRain {
		0% { transform: translateY(0); }
		100% { transform: translateY(25%); }
	}

	.vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.7) 100%);
		pointer-events: none;
	}

	.crt-frame {
		position: relative;
		z-index: 10;
		background: rgb(5, 15, 12);
		box-shadow:
			inset 0 0 60px rgba(155, 255, 203, 0.04),
			0 0 30px rgba(155, 255, 203, 0.05);
	}

	.avatar-ring {
		border: 2px solid rgba(155, 255, 203, 0.4);
		box-shadow: 0 0 20px rgba(155, 255, 203, 0.2);
	}

	.divider-line {
		height: 1px;
		background: linear-gradient(to right, transparent, rgba(155, 255, 203, 0.4), transparent);
	}

	.cursor-blink {
		animation: blink 1s step-end infinite;
	}

	@keyframes blink {
		50% { opacity: 0; }
	}
</style>

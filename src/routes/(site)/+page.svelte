<script lang="ts">
	import type { Page } from '$lib';
	import { SEO } from '@parallaxrealms/pxp-components';
	import JsonLd from '$lib/components/custom/seo/JsonLd.svelte';
	import Nav from '$lib/components/custom/nav/Nav.svelte';
	import Footer from '$lib/components/snippets/Footer.svelte';
	import ProjectCard from '$lib/components/custom/ProjectCard.svelte';
	import GradientText from '$lib/components/custom/effect/GradientText.svelte';
	import GlitchText from '$lib/components/custom/effect/GlitchText.svelte';
	import AboutTerminal from '$lib/components/custom/about/AboutTerminal.svelte';
	import ModelScene from '$lib/three/ModelScene.svelte';
	import { HERO_SCENE_CONFIG } from '$lib/three/heroConfig';
	import { getFeaturedProjects } from '$lib/data/projects';
	import { Label } from '$lib/components/shadcn/ui/label';
	import { Input } from '$lib/components/shadcn/ui/input';
	import { Textarea } from '$lib/components/shadcn/ui/textarea';
	import { Button } from '$lib/components/shadcn/ui/button';
	// No icons - text-only design

	let { data } = $props();
	let supabase = $derived.by(() => data.supabase);

	// Get featured projects
	const featuredWebProjects = getFeaturedProjects('web', 3);
	const featuredGameProjects = getFeaturedProjects('game', 3);

	// Get latest blog posts (already filtered and sorted by server)
	let latestPosts = $derived((data.pages || []).slice(0, 3) as Page[]);

	// Contact form state
	let contactForm = $state({ name: '', email: '', message: '' });
	let formStatus = $state<'idle' | 'sending' | 'success' | 'error'>('idle');
	let formMessage = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		formStatus = 'sending';

		try {
			const response = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(contactForm),
			});

			if (response.ok) {
				formStatus = 'success';
				formMessage = "Thanks for reaching out! I'll get back to you soon.";
				contactForm = { name: '', email: '', message: '' };
			} else {
				throw new Error('Failed to send message');
			}
		} catch {
			formStatus = 'error';
			formMessage = 'Something went wrong. Please try again.';
		}
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	}
</script>

<SEO
	title="Parallax&Pixel | Web & Game Development"
	description="Portfolio showcasing web development and game design projects. Building digital experiences with code and creativity."
	siteName="Parallax&Pixel"
	siteUrl="https://www.parallaxandpixel.com"
	author="Parallax"
	ogImage="/preview/self_circle.webp"
/>

<JsonLd
	data={{
		'@type': 'Person',
		name: 'Parallax',
		url: 'https://www.parallaxandpixel.com',
		image: 'https://www.parallaxandpixel.com/preview/self_circle.webp',
		jobTitle: 'Web & Game Developer',
		sameAs: ['https://github.com/parallaxrealms', 'https://parallaxpixels.itch.io/']
	}}
/>

<Nav {supabase} {data} variant="site" navbarLinks={data.navbarLinks} />

<!-- SECTION 1: Hero -->
<section id="home" class="relative min-h-screen overflow-hidden bg-black">
	<!-- Animated gradient background -->
	<div
		aria-hidden="true"
		class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,165,207,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(159,255,203,0.1),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(37,161,142,0.1),transparent_50%)]"
	></div>

	<!-- Three.js hero scene - full-bleed background layer behind the z-10 content.
	     Tint/vignette/scanline overlays are rendered by ModelScene itself,
	     driven by HERO_SCENE_CONFIG.overlay (tune in /lab). -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 z-[5]">
		<ModelScene config={HERO_SCENE_CONFIG} />
	</div>

	<div class="relative z-10 flex min-h-screen items-center px-6">
		<div class="mx-auto w-full max-w-6xl">
			<!-- Title - Full Width -->
			<div class="mb-12 text-center">
				<h1 class="font-display mb-6 text-5xl tracking-wide md:text-7xl">
					<span class="text-accent-primary">Parallax</span>
					<span class="text-slate-50">&</span>
					<span class="text-accent-highlight">Pixel</span>
				</h1>

				<GlitchText
					text="Welcome to my corner of the web. I like to build immersive experiences through code, design, and a little bit of chaos."
					tag="p"
					proximityMode={true}
					proximityRadius={30}
					proximityBoost={25}
					class="font-terminal mx-auto max-w-xl text-lg text-slate-400 md:text-xl"
				/>
			</div>

			<!-- Two Column: CTA & Latest Posts -->
			<div class="mt-12 grid items-start gap-8 md:grid-cols-2">
				<!-- Left: CTA -->
				<div class="flex flex-wrap justify-center gap-4 md:justify-start mt-32">
					<Button
						href="#projects"
						class="bg-accent-primary hover:bg-accent-primary/80 font-terminal text-slate-900"
					>
						View Work
					</Button>
					<Button
						href="#contact"
						variant="outline"
						class="font-terminal border-slate-600 text-slate-300 hover:border-accent-highlight hover:text-accent-highlight"
					>
						Get in Touch
					</Button>
				</div>

				<!-- Right: Latest Posts -->
				<div
					class="border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm"
				>
					<div class="mb-4 flex items-center justify-between">
						<h2 class="font-terminal text-sm font-semibold text-accent-primary">
							Latest Posts
						</h2>
						<a
							href="/blog"
							class="font-terminal text-xs text-slate-500 transition-colors hover:text-accent-primary"
						>
							View All
						</a>
					</div>

					{#if latestPosts.length > 0}
						<div class="space-y-3">
							{#each latestPosts as post (post.id)}
								<a
									href="/blog/{post.slug}"
									class="group block border-b border-slate-800 pb-3 last:border-0 last:pb-0"
								>
									<h3
										class="font-terminal text-sm font-medium text-slate-200 transition-colors group-hover:text-accent-primary"
									>
										{post.title}
									</h3>
									<span class="font-terminal text-xs text-slate-500">
										{formatDate(post.created_at)}
									</span>
								</a>
							{/each}
						</div>
					{:else}
						<p class="font-terminal text-sm text-slate-500">
							Blog posts coming soon!
						</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>

<!-- SECTION 2: About -->
<div id="about">
	<AboutTerminal />
</div>

<!-- SECTION 3: Web Projects -->
<section id="projects" class="bg-black py-24">
	<div class="mx-auto w-full max-w-screen-2xl px-8">
		<div class="mb-12 flex items-center justify-between">
			<h2 class="text-4xl text-slate-100 md:text-5xl">
				<span class="font-rubik text-accent-primary">Web</span>
				<span class="font-fade">Projects</span>
			</h2>
			<a
				href="/web"
				class="font-terminal flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-accent-primary"
			>
				View All
			</a>
		</div>

		<div class="grid gap-6 md:grid-cols-3">
			{#each featuredWebProjects as project (project.id)}
				<ProjectCard {project} variant="compact" />
			{/each}
		</div>
	</div>
</section>

<!-- SECTION 5: Game Projects -->
<section class="border-y border-slate-800 bg-slate-900/50 py-24">
	<div class="mx-auto w-full max-w-screen-2xl px-8">
		<div class="mb-12 flex items-center justify-between">
			<h2 class="text-4xl text-slate-100 md:text-5xl">
				<span class="font-rubik text-accent-highlight">Game</span>
				<span class="font-fade">Projects</span>
			</h2>
			<a
				href="/games"
				class="font-terminal flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-accent-highlight"
			>
				View All
			</a>
		</div>

		<div class="grid gap-6 md:grid-cols-3">
			{#each featuredGameProjects as project (project.id)}
				<ProjectCard {project} variant="compact" />
			{/each}
		</div>
	</div>
</section>

<!-- SECTION 6: Contact -->
<section id="contact" class="bg-black py-24">
	<div class="mx-auto max-w-2xl px-6">
		<div class="mb-12 text-center">
			<h2 class="text-4xl text-slate-100 md:text-5xl">
				<span class="font-rubik text-accent-primary">Get In</span>
				<span class="font-fade">Touch</span>
			</h2>
		</div>

		<form
			onsubmit={handleSubmit}
			class="border border-slate-800 bg-slate-900 p-8"
		>
			<!-- Status Message -->
			{#if formStatus === 'success' || formStatus === 'error'}
				<div
					class="mb-6 p-4 text-center font-terminal text-sm {formStatus ===
					'success'
						? 'bg-accent-primary/10 text-accent-primary'
						: 'bg-red-500/10 text-red-500'}"
				>
					{formMessage}
				</div>
			{/if}

			<div class="space-y-6">
				<div>
					<Label for="name" class="font-terminal text-slate-300">Name</Label>
					<Input
						id="name"
						type="text"
						bind:value={contactForm.name}
						required
						class="mt-1 font-terminal"
						placeholder="Your name"
					/>
				</div>

				<div>
					<Label for="email" class="font-terminal text-slate-300">Email</Label>
					<Input
						id="email"
						type="email"
						bind:value={contactForm.email}
						required
						class="mt-1 font-terminal"
						placeholder="your@email.com"
					/>
				</div>

				<div>
					<Label for="message" class="font-terminal text-slate-300"
						>Message</Label
					>
					<Textarea
						id="message"
						bind:value={contactForm.message}
						required
						rows={5}
						class="mt-1 resize-none font-terminal"
						placeholder="Tell me about your project..."
					/>
				</div>

				<Button
					type="submit"
					disabled={formStatus === 'sending'}
					class="w-full bg-accent-primary font-terminal text-slate-900 hover:bg-accent-primary/80"
				>
					{#if formStatus === 'sending'}
						Sending...
					{:else}
						Send Message
					{/if}
				</Button>
			</div>
		</form>

		<!-- Social Links -->
		<div class="mt-8 flex flex-wrap justify-center gap-4">
			<a
				href="https://github.com/parallaxrealms"
				target="_blank"
				rel="noopener noreferrer"
				class="font-terminal border border-slate-700 px-4 py-2 text-sm text-slate-500 transition-colors hover:border-accent-primary hover:text-accent-primary"
			>
				GitHub
			</a>
			<a
				href="https://parallaxpixels.itch.io/"
				target="_blank"
				rel="noopener noreferrer"
				class="font-terminal border border-slate-700 px-4 py-2 text-sm text-slate-500 transition-colors hover:border-accent-secondary hover:text-accent-secondary"
			>
				Itch.io
			</a>
		</div>
	</div>
</section>

<!-- SECTION 7: Footer -->
<Footer />

<script lang="ts">
	import type { Page } from '$lib';
	import { SEO, InView } from '@parallaxrealms/components-core';
	import Nav from '$lib/components/custom/nav/Nav.svelte';
	import Footer from '$lib/components/snippets/Footer.svelte';
	import ProjectCard from '$lib/components/custom/ProjectCard.svelte';
	import GradientText from '$lib/components/custom/effect/GradientText.svelte';
	import GlitchText from '$lib/components/custom/effect/GlitchText.svelte';
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

	// Get latest blog posts (from pages)
	let latestPosts = $derived((data.pages || []).slice(0, 3) as Page[]);

	// Skills/tech stack
	const skills = [
		{
			category: 'Web Dev and Apps',
			items: [
				'Svelte/SvelteKit',
				'Kotlin',
				'Node.js',
				'TypeScript',
				'PostgreSQL',
				'REST APIs',
			],
		},
		{
			category: 'Art & Design',
			items: [
				'Concept Art',
				'Pixel Art',
				'2D Animation',
				'3D Animation',
				'Graphic Design',
			],
		},
		{
			category: 'Game Dev',
			items: ['Godot', 'Unity', 'Game Design', 'Level Design', 'Shaders'],
		},
		{
			category: 'Languages',
			items: ['TypeScript', 'C#', 'GDScript', 'SQL', 'GLSL'],
		},
	];

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
/>

<Nav {supabase} {data} variant="site" navbarLinks={data.navbarLinks} />

<!-- SECTION 1: Hero -->
<section id="home" class="relative min-h-screen overflow-hidden bg-slate-950">
	<!-- Animated gradient background -->
	<div
		class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,165,207,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(159,255,203,0.1),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(37,161,142,0.1),transparent_50%)]"
	></div>

	<!-- Scanline overlay -->
	<div
		class="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)] opacity-30"
	></div>

	<div class="relative z-10 flex min-h-screen items-center px-6">
		<div class="mx-auto w-full max-w-6xl">
			<!-- Title - Full Width -->
			<div class="mb-12 text-center">
				<h1
					class="hero-title font-rubik mb-6 text-5xl tracking-wide md:text-7xl"
				>
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
			<div class="grid items-start gap-8 md:grid-cols-2">
				<!-- Left: CTA -->
				<div class="flex flex-wrap justify-center gap-4 md:justify-start">
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
<section id="about" class="relative overflow-hidden bg-slate-950 py-24">
	<!-- Background Image with Gradient Overlay (left half only) -->
	<div class="absolute inset-y-0 left-0 w-1/2">
		<img
			src="/selfgreece.webp"
			alt=""
			class="h-full w-full object-contain object-left opacity-40"
		/>
		<div class="absolute inset-0 bg-gradient-to-r from-transparent to-slate-950"></div>
	</div>

	<div class="relative z-10 mx-auto max-w-6xl px-6">
		<InView animation="fade-up">
			<div class="grid gap-12 md:grid-cols-5 md:items-center">
				<div class="md:col-span-3">
					<h2 class="mb-6 text-4xl text-slate-100 md:text-5xl">
						<span class="font-rubik text-accent-secondary">About</span> <span class="font-fade">Me</span>
					</h2>
					<div class="font-terminal space-y-5 text-lg leading-relaxed text-white font-semibold">
						<p>
							I make things for the web and build games on the side. Most of my time lately has been spent working on a dungeon crawler RPG—stay tuned.
						</p>
					</div>
				</div>

				<!-- Skills Grid -->
				<div class="grid grid-cols-2 gap-5 md:col-span-2">
					{#each skills as skill (skill.category)}
						<div class="border border-slate-800 bg-slate-900 p-5">
							<h3
								class="font-rubik-card mb-3 text-base text-accent-primary"
							>
								{skill.category}
							</h3>
							<ul class="space-y-2">
								{#each skill.items as item (item)}
									<li class="flex items-center gap-2 text-base text-slate-400">
										<span class="h-1.5 w-1.5 rounded-full bg-accent-highlight"
										></span>
										{item}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</div>
		</InView>
	</div>
</section>

<!-- SECTION 3: Web Projects -->
<section id="projects" class="bg-slate-950 py-24">
	<div class="mx-auto max-w-6xl px-6">
		<InView animation="fade-up">
			<div class="mb-12 flex items-center justify-between">
				<h2 class="text-4xl text-slate-100 md:text-5xl">
					<span class="font-rubik text-accent-primary">Web</span> <span class="font-fade">Projects</span>
				</h2>
				<a
					href="/web"
					class="font-terminal flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-accent-primary"
				>
					View All
				</a>
			</div>

			<div class="grid gap-8 md:grid-cols-3">
				{#each featuredWebProjects as project (project.id)}
					<ProjectCard {project} variant="compact" />
				{/each}
			</div>
		</InView>
	</div>
</section>

<!-- SECTION 5: Game Projects -->
<section class="border-y border-slate-800 bg-slate-900/50 py-24">
	<div class="mx-auto max-w-6xl px-6">
		<InView animation="fade-up">
			<div class="mb-12 flex items-center justify-between">
				<h2 class="text-4xl text-slate-100 md:text-5xl">
					<span class="font-rubik text-accent-highlight">Game</span> <span class="font-fade">Projects</span>
				</h2>
				<a
					href="/games"
					class="font-terminal flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-accent-highlight"
				>
					View All
				</a>
			</div>

			<div class="grid gap-8 md:grid-cols-3">
				{#each featuredGameProjects as project (project.id)}
					<ProjectCard {project} variant="compact" />
				{/each}
			</div>
		</InView>
	</div>
</section>

<!-- SECTION 6: Contact -->
<section id="contact" class="bg-slate-950 py-24">
	<div class="mx-auto max-w-2xl px-6">
		<InView animation="fade-up">
			<div class="mb-12 text-center">
				<h2 class="text-4xl text-slate-100 md:text-5xl">
					<span class="font-rubik text-accent-primary">Get In</span> <span class="font-fade">Touch</span>
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
						<Label for="email" class="font-terminal text-slate-300">Email</Label
						>
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
					href="https://github.com"
					target="_blank"
					rel="noopener noreferrer"
					class="font-terminal border border-slate-700 px-4 py-2 text-sm text-slate-500 transition-colors hover:border-accent-primary hover:text-accent-primary"
				>
					GitHub
				</a>
				<a
					href="https://instagram.com"
					target="_blank"
					rel="noopener noreferrer"
					class="font-terminal border border-slate-700 px-4 py-2 text-sm text-slate-500 transition-colors hover:border-accent-highlight hover:text-accent-highlight"
				>
					Instagram
				</a>
				<a
					href="https://itch.io"
					target="_blank"
					rel="noopener noreferrer"
					class="font-terminal border border-slate-700 px-4 py-2 text-sm text-slate-500 transition-colors hover:border-accent-secondary hover:text-accent-secondary"
				>
					Itch.io
				</a>
				<a
					href="https://bsky.app"
					target="_blank"
					rel="noopener noreferrer"
					class="font-terminal border border-slate-700 px-4 py-2 text-sm text-slate-500 transition-colors hover:border-accent-primary hover:text-accent-primary"
				>
					Bluesky
				</a>
			</div>
		</InView>
	</div>
</section>

<!-- SECTION 7: Footer -->
<Footer />

<style>
	/* Hero title - Rubik 900 default, Rubik Glitch on hover */
	.hero-title {
		position: relative;
		transition: text-shadow 0.1s ease;
	}

	.hero-title:hover {
		font-family: 'Rubik Glitch', system-ui;
		animation: glitch 1.2s ease-in-out infinite;
	}

	@keyframes glitch {
		0% {
			text-shadow:
				-6px 0 rgba(0, 165, 207, 0.9),
				6px 0 rgba(159, 255, 203, 0.9),
				0 0 20px rgba(0, 165, 207, 0.3);
			transform: translate(0);
		}
		10% {
			text-shadow:
				8px 2px rgba(159, 255, 203, 0.9),
				-8px -2px rgba(0, 165, 207, 0.9),
				0 0 30px rgba(159, 255, 203, 0.4);
			transform: translate(-2px, 1px);
		}
		20% {
			text-shadow:
				-4px -3px rgba(0, 165, 207, 0.9),
				4px 3px rgba(37, 161, 142, 0.9),
				-8px 0 rgba(159, 255, 203, 0.5);
			transform: translate(2px, -1px);
		}
		30% {
			text-shadow:
				10px 0 rgba(159, 255, 203, 0.9),
				-10px 0 rgba(0, 165, 207, 0.9),
				0 0 40px rgba(0, 165, 207, 0.5);
			transform: translate(0, 2px);
		}
		40% {
			text-shadow:
				-5px 4px rgba(37, 161, 142, 0.9),
				5px -4px rgba(159, 255, 203, 0.9),
				8px 0 rgba(0, 165, 207, 0.6);
			transform: translate(-1px, -2px);
		}
		50% {
			text-shadow:
				6px -2px rgba(0, 165, 207, 0.9),
				-6px 2px rgba(159, 255, 203, 0.9),
				0 0 25px rgba(37, 161, 142, 0.4);
			transform: translate(1px, 0);
		}
		60% {
			text-shadow:
				-8px 0 rgba(159, 255, 203, 0.9),
				8px 0 rgba(37, 161, 142, 0.9),
				-4px 4px rgba(0, 165, 207, 0.5);
			transform: translate(-2px, 1px);
		}
		70% {
			text-shadow:
				4px 3px rgba(0, 165, 207, 0.9),
				-4px -3px rgba(159, 255, 203, 0.9),
				0 0 35px rgba(159, 255, 203, 0.5);
			transform: translate(0, -1px);
		}
		80% {
			text-shadow:
				-10px -1px rgba(37, 161, 142, 0.9),
				10px 1px rgba(0, 165, 207, 0.9),
				6px 0 rgba(159, 255, 203, 0.6);
			transform: translate(2px, 2px);
		}
		90% {
			text-shadow:
				7px 0 rgba(159, 255, 203, 0.9),
				-7px 0 rgba(0, 165, 207, 0.9),
				0 0 20px rgba(0, 165, 207, 0.3);
			transform: translate(-1px, 0);
		}
		100% {
			text-shadow:
				-6px 0 rgba(0, 165, 207, 0.9),
				6px 0 rgba(159, 255, 203, 0.9),
				0 0 20px rgba(0, 165, 207, 0.3);
			transform: translate(0);
		}
	}
</style>

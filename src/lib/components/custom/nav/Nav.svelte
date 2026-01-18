<!-- src/lib/components/custom/nav/Nav.svelte -->
<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { NavbarLink } from '$lib';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	interface Props {
		data?: any;
		supabase?: SupabaseClient;
		variant?: 'site' | 'dashboard';
		navbarLinks?: NavbarLink[];
	}

	let {
		data,
		supabase,
		variant = 'site',
		navbarLinks = []
	}: Props = $props();

	let mobileMenuOpen = $state(false);

	// Static navigation links
	const staticLinks = [
		{ name: 'Blog', href: '/blog' },
		{ name: 'Web', href: '/web' },
		{ name: 'Games', href: '/games' },
		{ name: 'Contact', href: '/#contact' }
	];

	// Filter active database links for display
	let activeDbLinks = $derived(navbarLinks.filter((link) => link.is_active));

	// Check if current path matches link
	function isActive(href: string): boolean {
		const currentPath = $page.url.pathname;
		if (href === '/') return currentPath === '/';
		return currentPath.startsWith(href);
	}

	function scrollToId(hash: string) {
		const el = document.querySelector(hash);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function handleNav(href: string) {
		mobileMenuOpen = false;
		if (variant === 'dashboard') {
			if (href.startsWith('#')) {
				goto(`/${href}`, { replaceState: false });
			} else {
				goto(href, { replaceState: false });
			}
		} else if (variant === 'site') {
			if (href.startsWith('#')) {
				scrollToId(href);
			} else if (href.startsWith('/#')) {
				// Handle links like /#contact from other pages
				if ($page.url.pathname !== '/') {
					goto(href);
				} else {
					scrollToId(href.substring(1));
				}
			} else {
				goto(href);
			}
		}
	}
</script>

<nav class="navbar-glass sticky top-0 z-50">
	<div class="flex items-center justify-between px-8 py-1.5">
		<!-- Logo (left) -->
		<a href="/" class="group flex shrink-0 items-center">
			<img src="/icon_p.webp" alt="Parallax & Pixel" class="h-6 w-6" />
		</a>

		<!-- Desktop Navigation (right) -->
		<div class="hidden shrink-0 items-center gap-0.5 md:flex">
			<!-- Static Links -->
			{#each staticLinks as link (link.href)}
				<button
					type="button"
					onclick={() => handleNav(link.href)}
					class="nav-link font-terminal px-2.5 py-1 text-xs transition-all {isActive(link.href) ? 'text-accent-primary' : ''}"
				>
					{link.name}
				</button>
			{/each}

			<!-- Database Links (if any) -->
			{#each activeDbLinks as link (link.id)}
				<button
					type="button"
					onclick={() => handleNav(link.url)}
					class="nav-link font-terminal px-2.5 py-1 text-xs transition-all"
				>
					{link.name}
				</button>
			{/each}
		</div>

		<!-- Mobile Navigation -->
		<div class="flex flex-1 items-center justify-end md:hidden">
			<!-- Mobile Menu Button -->
			<button
				type="button"
				onclick={() => mobileMenuOpen = !mobileMenuOpen}
				class="font-terminal px-2 py-0.5 text-xs text-slate-400 hover:text-accent-primary"
				aria-label="Toggle menu"
			>
				Menu
			</button>
		</div>
	</div>

	<!-- Mobile Menu -->
	{#if mobileMenuOpen}
		<div class="border-t border-slate-700/50 bg-slate-900/90 px-4 py-3 md:hidden">
			<div class="flex flex-col gap-1">
				{#each staticLinks as link (link.href)}
					<button
						type="button"
						onclick={() => handleNav(link.href)}
						class="font-terminal rounded px-3 py-1.5 text-left text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-accent-primary {isActive(link.href) ? 'text-accent-primary' : ''}"
					>
						{link.name}
					</button>
				{/each}

				{#each activeDbLinks as link (link.id)}
					<button
						type="button"
						onclick={() => handleNav(link.url)}
						class="font-terminal rounded px-3 py-1.5 text-left text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-accent-primary"
					>
						{link.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</nav>

<style>
	/* Navbar Glass Effect - Slate with frosted glass */
	.navbar-glass {
		background: rgba(15, 23, 42, 0.75); /* slate-900 with transparency */
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid rgba(51, 65, 85, 0.4); /* slate-700 */
		transition: all 200ms;
	}

	/* Nav Link Styles */
	.nav-link {
		color: #94a3b8; /* slate-400 */
		position: relative;
	}

	.nav-link:hover {
		color: var(--accent-primary);
	}
</style>

<!-- src/lib/components/custom/nav/DashboardNav.svelte -->
<script lang="ts" module>
	export interface DashboardNavProps {
		isOpen: boolean;
		isMobile: boolean;
		toggleSidebar: (event?: MouseEvent) => void;
		supabase: any;
		height?: string;
	}

	export interface CustomLink {
		name: string;
		url: string;
	}
</script>

<script lang="ts">
	import { Button, ToggleFlip } from '@parallaxrealms/components-core';
	import { browser } from '$app/environment';
	import { invalidate } from '$app/navigation';
	import { applyAction, enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { Link as LinkIcon, LogOut } from 'lucide-svelte';

	let {
		isOpen,
		isMobile,
		toggleSidebar,
		supabase,
		height = '3.25rem'
	}: DashboardNavProps = $props();

	let loading = $state(false);
	let customLinks = $state<CustomLink[]>([]);
	let profileLoaded = $state(false);
	let userRole = $state<string>('unknown');
	let isAdmin = $derived.by(() => userRole === 'admin');

	async function loadUserRole() {
		if (!browser || !supabase) return;

		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) return;

			const { data, error } = await supabase
				.from('user_roles')
				.select('role')
				.eq('user_id', user.id)
				.single();

			if (error) throw error;
			userRole = data?.role ?? 'unknown';
		} catch (err) {
			console.error('Error fetching user role:', err);
		}
	}

	const handleLogout = ({ formElement }: { formElement: HTMLFormElement }) => {
		loading = true;

		return async ({ action }: { action: URL }) => {
			const formData = new FormData(formElement);
			const response = await fetch(action, {
				method: 'POST',
				body: formData
			});

			const result: ActionResult = await response.json();
			await applyAction(result);
			await invalidate('supabase:auth');
			loading = false;
		};
	};

	$effect(() => {
		loadUserRole();
	});
</script>

<nav class="navbar" style="height: {height}">
	<div class="navbar-content">
		<!-- Left Section -->
		<div class="navbar-left flex items-center">
			<ToggleFlip {isOpen} {toggleSidebar} />
			<a href="/dashboard" class="navbar-title">
				<span class="font-pixel">Command</span>
				<span class="text-slate-50"> // </span>
				<span class="font-pixel">Center</span>
			</a>
		</div>

		<!-- Custom Links Section -->
		{#if profileLoaded && customLinks.length > 0}
			<div class="navbar-links">
				{#each customLinks as link}
					<a href={link.url} target="_blank" rel="noopener noreferrer" class="navbar-link">
						<LinkIcon class="navbar-link-icon" />
						{link.name}
					</a>
				{/each}
			</div>
		{/if}

		<!-- Right Section -->
		<div class="navbar-right">
			<Button variant="ghost" size="sm" href="/" class="navbar-logout">
				<span class="text-xs">View Website</span>
			</Button>
			{#if isAdmin}
				<span class="navbar-role">{userRole}</span>
			{/if}

			<form action="/auth/logout" method="post" use:enhance={handleLogout}>
				<Button type="submit" variant="ghost" size="sm" disabled={loading} class="navbar-logout">
					<LogOut class="mr-2 h-4 w-4" />
					<span class="text-xs">Logout</span>
				</Button>
			</form>
		</div>
	</div>
</nav>

<style>
	/* Dashboard navbar - slate theme */
	.navbar {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		z-index: 50;
		background-color: #0f172a; /* slate-900 */
		border-bottom: 1px solid #334155; /* slate-700 */
		padding: 0.25rem 0;
		color: #f8fafc; /* slate-50 */
	}

	.navbar-content {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.375rem;
	}

	.navbar-left {
		gap: 0.75rem;
	}

	.navbar-title {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		font-size: 1.125rem;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.navbar-title :global(.font-pixel) {
		color: #00a5cf; /* accent-primary */
	}

	.navbar-title:hover :global(.font-pixel) {
		color: #9fffcb; /* accent-highlight */
	}

	.navbar-links {
		display: none;
		align-items: center;
		gap: 0.5rem;
		margin: 0 auto;
	}

	@media (min-width: 768px) {
		.navbar-links {
			display: flex;
		}
	}

	.navbar-link {
		display: flex;
		align-items: center;
		background-color: #1e293b; /* slate-800 */
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		color: #f8fafc; /* slate-50 */
		text-decoration: none;
		transition: all 150ms;
	}

	.navbar-link:hover {
		background-color: #00a5cf;
		color: #020617;
	}

	:global(.navbar-link-icon) {
		margin-right: 0.5rem;
		height: 1rem;
		width: 1rem;
	}

	.navbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.navbar-role {
		font-size: 0.75rem;
		color: #94a3b8; /* slate-400 */
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.25rem 0.5rem;
		background-color: #1e293b; /* slate-800 */
	}

	:global(.navbar-logout) {
		transition: all 150ms;
		color: #cbd5e1 !important; /* slate-300 */
	}

	:global(.navbar-logout:hover) {
		color: #00a5cf !important;
		background-color: rgba(0, 165, 207, 0.1) !important;
	}
</style>

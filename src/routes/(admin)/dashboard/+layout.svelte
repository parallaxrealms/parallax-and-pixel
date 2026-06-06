<!-- src/routes/(admin)/dashboard/+layout.svelte -->
<script lang="ts">
	import '../../../app.css';
	import { browser } from '$app/environment';
	import { selectedTab } from '@parallaxrealms/pxp-utils/stores-core';
	import { hydrateDashboard, isAdmin as isAdminStore } from '@parallaxrealms/pxp-utils/stores-ecom';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/custom/sidebar/Sidebar.svelte';
	import DashboardNav from '$lib/components/custom/nav/DashboardNav.svelte';
	import { Button } from '@parallaxrealms/pxp-components';
	import { Home, ArrowLeft, FileText, Image, Share2, Activity } from 'lucide-svelte';
	import { createSidebarConfig } from '@parallaxrealms/pxp-utils/core';

	let { children, data } = $props();

	let supabase = $derived(data.supabase);
	let session = $derived(data.session);

	// Use store values instead of local state
	let isAdmin = $derived($isAdminStore);
	let preferencesLoaded = $state(false);

	// Hydrate dashboard from server data (user role, notifications, support tickets)
	// Server data is guaranteed to be available - no race conditions
	// See ref/DATA-LOADING.md for the full pattern
	$effect(() => {
		if (browser && data.dashboardData) {
			hydrateDashboard(data.dashboardData);
		}
	});

	// Apply user preferences from server-loaded settings
	$effect(() => {
		if (browser && data.dashboardData?.userSettings && !preferencesLoaded) {
			const settings = data.dashboardData.userSettings as Record<string, string>;

			if (settings.default_tab && settings.default_tab !== $selectedTab) {
				selectedTab.set(settings.default_tab);
			}

			preferencesLoaded = true;
		}
	});

	// Use local state for sidebar
	let isOpen = $state(false);
	let isMobile = $state(false);

	// Handle resize events
	function handleResize() {
		if (browser) {
			const width = window.innerWidth;
			const newIsMobile = width <= 779;
			const newIsTablet = width > 779 && width <= 1279;

			// Update mobile state
			if (newIsMobile !== isMobile) {
				isMobile = newIsMobile;
			}

			// Handle state transitions
			if (newIsMobile) {
				isOpen = false;
			} else if (newIsTablet) {
				isOpen = false;
			} else {
				isOpen = true;
			}

			// Disable transitions during resize to prevent bounce
			const sidebar = document.getElementById('sidebar');
			if (sidebar) {
				sidebar.classList.add('no-transitions');
				setTimeout(() => {
					sidebar.classList.remove('no-transitions');
				}, 100);
			}
		}
	}

	// Add event listeners
	$effect(() => {
		if (browser) {
			window.addEventListener('resize', handleResize);
			document.addEventListener('click', closeSidebarOnOutsideClick);

			return () => {
				window.removeEventListener('resize', handleResize);
				document.removeEventListener('click', closeSidebarOnOutsideClick);
			};
		}
	});

	function toggleSidebar(event?: MouseEvent) {
		if (event) event.stopPropagation();
		isOpen = !isOpen;
	}

	function closeSidebarOnOutsideClick(event: MouseEvent) {
		if (isMobile && isOpen) {
			const sidebar = document.getElementById('sidebar');
			const target = event.target as HTMLElement;

			if (sidebar && !sidebar.contains(target)) {
				isOpen = false;
			}
		}
	}

	// Initialize sidebar state based on screen size (only once on mount)
	onMount(() => {
		if (browser) {
			const width = window.innerWidth;

			if (width <= 779) {
				isMobile = true;
				isOpen = false;
			} else if (width <= 1279) {
				isMobile = false;
				isOpen = false;
			} else {
				isMobile = false;
				isOpen = true;
			}
		}
	});

	const dashboardItems = [
		{
			id: 'home',
			label: 'Dashboard',
			icon: Home,
			tabId: 'home',
			adminOnly: false
		},
		{
			id: 'website',
			label: 'Pages',
			icon: FileText,
			tabId: 'website',
			adminOnly: false
		},
		{
			id: 'media',
			label: 'MediaLibrary',
			icon: Image,
			tabId: 'media',
			adminOnly: false
		},
		{
			id: 'social',
			label: 'Social',
			icon: Share2,
			tabId: 'social',
			adminOnly: true
		},
		{
			id: 'telemetry',
			label: 'Telemetry',
			icon: Activity,
			tabId: 'telemetry',
			adminOnly: true
		}
	];

	const footerItems = [
		{
			id: 'logout',
			label: 'Log out',
			icon: ArrowLeft,
			adminOnly: false,
			action: () => {
				console.log('Logout clicked');
			}
		}
	];

	const customConfig = createSidebarConfig()
		.sidebar({
			widthExpanded: '15rem',
			widthCollapsed: '4rem',
			bg: '#0f172a', /* slate-900 */
			border: '#334155', /* slate-700 */
			padding: '0.25rem',
			margin: '0',
			gap: '0.5rem',
			radiusContainer: '0',
			radiusItem: '0',
			radiusButton: '0',
			radiusChildItem: '0',
			alignContentExpanded: 'start',
			alignContentCollapsed: 'center'
		})
		.sbi({
			bg: 'transparent',
			text: '#94a3b8', /* slate-400 */
			hoverBg: '#1e293b', /* slate-800 */
			activeBg: '#00a5cf', /* accent-primary */
			activeText: '#020617', /* slate-950 */
			labelSpacing: '0.75rem',
			height: '2.5rem',
			fontSize: '0.875rem',
			duration: '0.2s',
			iconSize: '1.25rem',
			radius: '0'
		})
		.behavior({
			autoCollapse: true,
			persistState: true,
			showTooltips: true,
			expandOnHover: false
		})
		.animations({
			sidebarDuration: '0.3s',
			sidebarEasing: 'ease-in-out',
			sidebarHoverScale: 1.02,
			sidebarItemDuration: '0.2s',
			sidebarItemDropdownEasing: 'ease-in-out',
			sidebarItemDropdownDuration: '0.3s'
		})
		.responsive({
			mobileBreakpoint: '768px',
			tabletBreakpoint: '1024px',
			desktopBreakpoint: '1280px',
			mobileState: 'hidden',
			tabletState: 'collapsed',
			desktopState: 'expanded'
		})
		.build();
</script>

{#if session}
	<div
		role="presentation"
		class="dashboard-layout bg-slate-950"
		onclick={isMobile && isOpen ? closeSidebarOnOutsideClick : undefined}
	>
		<Sidebar
			items={dashboardItems}
			{footerItems}
			config={customConfig}
			{supabase}
			{isOpen}
			{isMobile}
			{isAdmin}
		/>

		<DashboardNav {isOpen} {isMobile} {toggleSidebar} {supabase} height="4rem" />

		<div class={`dashboard-main ${isMobile ? 'w-full' : isOpen ? 'ml-[15rem]' : 'ml-[4rem]'}`}>
			<main class="dashboard-content">
				<div class="mx-auto">
					{@render children()}
				</div>
			</main>
		</div>
	</div>
{:else}
	<div class="dashboard-login">
		<div class="dashboard-login-card">
			<h2 class="dashboard-login-title">Welcome Back</h2>
			<p class="dashboard-login-text">Please sign in to access your dashboard</p>
			<Button href="/auth" variant="default" size="lg">Sign In</Button>
		</div>
	</div>
{/if}

<style>
	.dashboard-layout {
		position: relative;
		display: flex;
		height: 100%;
		background-color: #020617; /* slate-950 */
	}

	.dashboard-main {
		display: flex;
		flex: 1;
		flex-direction: column;
		transition: all 0.3s;
		overflow-x: hidden;
		max-width: 100%;
	}

	.dashboard-content {
		margin-top: 2.5rem;
		min-height: 100vh;
		background-color: #020617; /* slate-950 */
	}

	.dashboard-login {
		display: flex;
		height: 100vh;
		align-items: center;
		justify-content: center;
		background-color: #020617; /* slate-950 */
	}

	.dashboard-login-card {
		text-align: center;
		padding: 2rem;
		background-color: #1e293b; /* slate-800 */
		border: 1px solid #334155; /* slate-700 */
		max-width: 24rem;
		width: 100%;
		margin: 0 1rem;
	}

	.dashboard-login-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #00a5cf; /* accent-primary */
		margin-bottom: 0.5rem;
	}

	.dashboard-login-text {
		color: #94a3b8; /* slate-400 */
		margin-bottom: 1.5rem;
	}
</style>

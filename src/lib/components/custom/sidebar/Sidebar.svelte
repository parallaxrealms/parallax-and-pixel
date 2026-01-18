<!-- Sidebar.svelte - Clean, configurable sidebar component -->
<script lang="ts">
	import { sidebarState, sidebarConfig, sidebarActions } from '@parallaxrealms/stores-core';
	import { selectedTab } from '@parallaxrealms/stores-core';
	import SidebarItem from './SidebarItem.svelte';
	import type { SidebarItem as SidebarItemType, SidebarConfig } from '@parallaxrealms/types-core';
	import type { UserProfile } from '@parallaxrealms/types-auth';
	import { ArrowLeft, User, Settings, ChevronDown, ChevronRight } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let {
		id = 'sidebar',
		className = '',
		items = [],
		footerItems = [],
		config = {},
		supabase = null,
		isOpen = false,
		isMobile = false,
		isAdmin = false
	} = $props<{
		id?: string;
		className?: string;
		items?: SidebarItemType[];
		footerItems?: SidebarItemType[];
		config?: Partial<SidebarConfig>;
		supabase?: any;
		isOpen?: boolean;
		isMobile?: boolean;
		isAdmin?: boolean;
	}>();

	// User profile and role state
	let profile = $state<UserProfile | null>(null);
	let userRole = $state<string>('unknown');
	let isUserAdmin = $derived.by(() => userRole === 'admin');
	let isLoadingUser = $state(true);

	// Avatar logic
	let avatarInitial = $derived.by(() => {
		if (profile?.username) {
			return profile.username.charAt(0).toUpperCase();
		}
		return 'U';
	});

	// Load user profile and role
	async function loadUserProfile() {
		if (!browser || !supabase) return;

		try {
			// Get current user
			const {
				data: { user }
			} = await supabase.auth.getUser();

			if (!user) return;

			// Get profile
			const { data, error: profileError } = await supabase
				.from('user_profiles')
				.select('*')
				.eq('user_id', user.id)
				.single();

			if (profileError) throw profileError;

			profile = data as UserProfile;
		} catch (err) {
			console.error('Error loading user profile:', err);
		} finally {
			isLoadingUser = false;
		}
	}

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

	// Load user data on mount
	$effect(() => {
		if (supabase) {
			loadUserProfile();
			loadUserRole();
		}
	});

	// Apply custom config
	$effect(() => {
		if (Object.keys(config).length > 0) {
			sidebarActions.updateConfig(config);
		}
	});

	// Local state for sidebar functionality
	let activeItem = $state('');
	let expandedItems = $state<string[]>([]);
	let showUserDropdown = $state(false);

	// Track previous sidebar state to detect changes
	let previousIsOpen = $state(isOpen);

	// Collapse all expanded items when sidebar state changes
	$effect(() => {
		// Only collapse if the state actually changed
		if (previousIsOpen !== isOpen) {
			// Collapse immediately to sync with sidebar animation
			expandedItems = [];
			previousIsOpen = isOpen;
		}
	});

	// Scrollbar detection for icon sizing
	let hasScrollbar = $state(false);
	let sidebarElement: HTMLElement;

	// Check if sidebar has scrollbar
	function checkScrollbar() {
		if (sidebarElement) {
			hasScrollbar = sidebarElement.scrollHeight > sidebarElement.clientHeight;
		}
	}

	// Watch for scrollbar changes
	$effect(() => {
		if (sidebarElement) {
			checkScrollbar();

			// Use ResizeObserver to detect when content changes
			const resizeObserver = new ResizeObserver(() => {
				checkScrollbar();
			});

			resizeObserver.observe(sidebarElement);

			return () => {
				resizeObserver.disconnect();
			};
		}
	});

	// Default footer items
	const defaultFooterItems: SidebarItemType[] = [
		{
			id: 'back',
			label: 'Back to Site',
			icon: ArrowLeft,
			href: '/',
			action: () => goto('/')
		},
		{
			id: 'user-settings',
			label: 'User Settings',
			icon: User,
			action: () => sidebarActions.setActiveItem('user-settings')
		}
	];

	// Combine footer items
	const allFooterItems = [...footerItems, ...defaultFooterItems];

	// Filter items based on visibility and admin status
	const visibleItems = $derived(
		items.filter((item: SidebarItemType) => {
			if (item.visible === false) return false;
			if (item.adminOnly && !isAdmin) {
				return false;
			}
			return true;
		})
	);

	function handleItemClick(item: SidebarItemType, isChild = false) {
		activeItem = item.id;

		// Only collapse expanded items if clicking a top-level item (not a child)
		if (!isChild && (!item.children || item.children.length === 0)) {
			expandedItems = [];
		}

		// Close footer dropdown when navigating
		showUserDropdown = false;

		// Handle tab navigation
		if (item.tabId) {
			// Update the selectedTab store for tab navigation
			selectedTab.set(item.tabId);
		}
	}

	function handleToggleExpanded(itemId: string) {
		if (expandedItems.includes(itemId)) {
			expandedItems = expandedItems.filter((id) => id !== itemId);
		} else {
			expandedItems = [...expandedItems, itemId];
		}
	}

	function handleCollapseOthers() {
		expandedItems = [];
	}

	function toggleUserDropdown() {
		showUserDropdown = !showUserDropdown;
	}

	// Handle outside clicks to close dropdown
	function handleOutsideClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		const userProfileSection = document.querySelector('.user-profile-section');

		if (userProfileSection && !userProfileSection.contains(target)) {
			showUserDropdown = false;
		}
	}

	// Add event listener for outside clicks
	$effect(() => {
		if (showUserDropdown) {
			document.addEventListener('click', handleOutsideClick);
			return () => {
				document.removeEventListener('click', handleOutsideClick);
			};
		}
	});

	function handleAdminSettingsClick() {
		activeItem = 'admin-settings';
		handleToggleExpanded('admin-settings');
	}

	function handleFooterItemClick(item: SidebarItemType) {
		// Close the dropdown
		showUserDropdown = false;

		// Handle different types of footer item actions
		if (item.href) {
			// Navigate to a URL
			goto(item.href);
		} else if (item.action) {
			// Execute a custom action
			item.action();
		} else if (item.tabId) {
			// Update the selectedTab store for tab navigation
			selectedTab.set(item.tabId);
		}
	}
</script>

<div
	{id}
	class="sidebar {isOpen ? 'open' : 'collapsed'} {className}"
	class:open={isOpen}
	class:mobile={isMobile}
	bind:this={sidebarElement}
	style="
		--sbi-width-expanded: {$sidebarConfig.sidebar.widthExpanded};
		--sbi-width-collapsed: {$sidebarConfig.sidebar.widthCollapsed};
		--sbi-bg: {$sidebarConfig.sidebar.bg};
		--sbi-border: {$sidebarConfig.sidebar.border};
		--sbi-padding: {$sidebarConfig.sidebar.padding};
		--sbi-margin: {$sidebarConfig.sidebar.margin};
		--sbi-gap: {$sidebarConfig.sidebar.gap};
		--sbi-radius-container: {$sidebarConfig.sidebar.radiusContainer};
		--sbi-radius-item: {$sidebarConfig.sidebar.radiusItem};
		--sbi-radius-button: {$sidebarConfig.sidebar.radiusButton};
		--sbi-radius-child: {$sidebarConfig.sidebar.radiusChildItem};
		--sbi-align-expanded: {$sidebarConfig.sidebar.alignContentExpanded};
		--sbi-align-collapsed: {$sidebarConfig.sidebar.alignContentCollapsed};
		--sbi-duration: {$sidebarConfig.animations.sidebarDuration};
		--sbi-easing: {$sidebarConfig.animations.sidebarEasing};
		--sbi-hover-scale: {$sidebarConfig.animations.sidebarHoverScale};
		--sbi-item-duration: {$sidebarConfig.animations.sidebarItemDuration};
		--sbi-dropdown-easing: {$sidebarConfig.animations.sidebarItemDropdownEasing};
		--sbi-dropdown-duration: {$sidebarConfig.animations.sidebarItemDropdownDuration};
		--sbi-text: {$sidebarConfig.sbi.text};
		--sbi-hover-bg: {$sidebarConfig.sbi.hoverBg};
		--sbi-active-bg: {$sidebarConfig.sbi.activeBg};
		--sbi-active-text: {$sidebarConfig.sbi.activeText};
		--sbi-label-spacing: {$sidebarConfig.sbi.labelSpacing};
		--sbi-height: {$sidebarConfig.sbi.height};
		--sbi-font-size: {$sidebarConfig.sbi.fontSize};
		--sbi-icon-size: {$sidebarConfig.sbi.iconSize};
		--sbi-radius: {$sidebarConfig.sbi.radius};
	"
>
	<!-- Main Navigation -->
	<nav class="sidebar-nav">
		<ul class="sidebar-items">
			{#each visibleItems as item}
				<SidebarItem
					{item}
					{isOpen}
					{activeItem}
					{expandedItems}
					onItemClick={handleItemClick}
					onToggleExpanded={handleToggleExpanded}
					onCollapseOthers={handleCollapseOthers}
					sidebarConfig={$sidebarConfig}
				/>
			{/each}
		</ul>
	</nav>

	<!-- Footer -->
	<footer class="sidebar-footer">
		<div class="sidebar-footer-content">
			<!-- User Profile Section -->
			<div class="user-profile-section">
				<button class="user-profile-card" class:collapsed={!isOpen} onclick={toggleUserDropdown}>
					<div class="user-avatar">
						{#if profile?.avatar_url}
							<img
								src={profile.avatar_url}
								alt="{profile.username || 'User'} avatar"
								class="avatar-image"
							/>
						{:else}
							<div class="avatar-placeholder">
								<span class="avatar-initial">{avatarInitial}</span>
							</div>
						{/if}
					</div>
					<div class="user-info" class:expanded={isOpen} class:collapsed={!isOpen}>
						<div class="user-name">
							{#if isLoadingUser}
								Loading...
							{:else if profile?.username}
								{profile.username}
							{:else}
								User
							{/if}
						</div>
						{#if isUserAdmin}
							<div class="user-plan">Admin</div>
						{/if}
					</div>
				</button>

				<div
					class="user-dropdown-menu"
					class:expanded={showUserDropdown}
					class:collapsed={!showUserDropdown}
				>
					{#each footerItems as item}
						{#if !item.adminOnly || isAdmin}
							<button
								class="dropdown-item"
								class:logout={item.id === 'logout'}
								onclick={() => handleFooterItemClick(item)}
							>
								{#if item.icon}
									<item.icon class="dropdown-item-icon" />
								{/if}
								<span>{item.label}</span>
								{#if item.hasArrow}
									<ChevronRight class="dropdown-arrow" />
								{/if}
							</button>
						{/if}
					{/each}
				</div>
			</div>

			<!-- Footer Items -->
		</div>
	</footer>

	<!-- Mobile overlay removed - sidebar slides out beside navbar -->
</div>

<style>
	/* Slate color overrides for Parallax & Pixel */
	:root {
		--sidebar-slate-950: #020617;
		--sidebar-slate-900: #0f172a;
		--sidebar-slate-800: #1e293b;
		--sidebar-slate-700: #334155;
		--sidebar-slate-400: #94a3b8;
		--sidebar-slate-300: #cbd5e1;
		--sidebar-accent: #00a5cf;
	}

	.sidebar {
		position: fixed;
		top: 4rem; /* Account for navbar height */
		left: 0;
		height: calc(100vh - 4rem); /* Subtract navbar height */
		width: var(--sbi-width-collapsed);
		background-color: var(--sbi-bg, var(--sidebar-slate-900));
		border-right: 1px solid var(--sbi-border, var(--sidebar-slate-700));
		overflow-y: auto;
		overflow-x: hidden; /* Prevent horizontal scrollbar */
		transition: width var(--sbi-duration) var(--sbi-easing);
		z-index: 50;
		display: flex;
		flex-direction: column;
		border-radius: var(--sbi-radius-container);
		padding: var(--sbi-padding);
		margin: var(--sbi-margin);
		gap: var(--sbi-gap);
		align-items: var(--sbi-align-collapsed);
		/* Prevent content jitter during transitions */
		contain: layout style;
		will-change: width;
	}

	.sidebar.no-transitions {
		transition: none !important;
	}

	.sidebar.open {
		width: var(--sbi-width-expanded);
		align-items: var(--sbi-align-expanded);
		/* Ensure smooth transition without content jitter */
		overflow: hidden;
	}

	/* Mobile sidebar - hidden by default, slides in when open */
	.sidebar.mobile {
		position: fixed !important;
		top: 4rem !important; /* Start below navbar */
		left: 0 !important;
		height: calc(100vh - 4rem) !important; /* Full height minus navbar */
		width: var(--sbi-width-expanded) !important;
		z-index: 60 !important;
		transform: translateX(-100%);
		transition: transform var(--sbi-duration) var(--sbi-easing);
		background-color: var(--sbi-bg);
		border-right: 1px solid var(--sbi-border);
		overflow-y: auto;
		overflow-x: hidden; /* Prevent horizontal scrollbar */
		display: flex;
		flex-direction: column;
	}

	.sidebar.mobile.no-transitions {
		transition: none !important;
	}

	.sidebar.mobile.open {
		transform: translateX(0) !important;
	}

	.sidebar.mobile .sidebar-nav {
		flex: 1;
		padding: var(--sbi-padding);
		overflow-y: auto;
		height: calc(100vh - 8rem); /* Account for navbar + footer */
	}

	.sidebar.mobile .sidebar-footer {
		padding: var(--sbi-padding);
		border-top: 1px solid var(--sbi-border);
		background-color: var(--sbi-bg);
		height: 4rem; /* Fixed footer height */
		flex-shrink: 0;
	}

	.sidebar-nav {
		flex: 1;
		padding: var(--sbi-padding);
		overflow-y: auto;
		width: 100%;
		/* Prevent content from jumping during sidebar transitions */
		transition: none;
		contain: layout;
	}

	.sidebar-items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sbi-gap);
		/* Prevent items from jittering during sidebar transitions */
		contain: layout;
		transform: translateZ(0);
		backface-visibility: hidden;
	}

	.sidebar-footer {
		padding: var(--sbi-padding);
		border-top: 1px solid var(--sbi-border);
		background-color: var(--sbi-bg);
		margin-top: auto;
		width: 100%;
	}

	.sidebar-footer-content {
		display: flex;
		flex-direction: column;
		gap: var(--sbi-gap);
	}

	/* Scrollbar styling - Slate theme */
	.sidebar .sidebar-nav::-webkit-scrollbar {
		width: 2px;
	}

	.sidebar .sidebar-nav::-webkit-scrollbar-track {
		background: transparent;
	}

	.sidebar .sidebar-nav::-webkit-scrollbar-thumb {
		background: var(--sidebar-slate-700);
		transition: all 0.2s ease;
	}

	.sidebar .sidebar-nav::-webkit-scrollbar-thumb:hover {
		background: var(--sidebar-slate-400);
	}

	.sidebar .sidebar-nav::-webkit-scrollbar-thumb:active {
		background: var(--sidebar-accent);
	}

	/* Firefox scrollbar styling */
	.sidebar .sidebar-nav {
		scrollbar-width: thin;
		scrollbar-color: var(--sidebar-slate-700) transparent;
	}

	/* Hide scrollbar when not needed */
	.sidebar .sidebar-nav:not(:hover)::-webkit-scrollbar-thumb {
		background: transparent;
	}

	/* Show scrollbar on hover */
	.sidebar .sidebar-nav:hover::-webkit-scrollbar-thumb {
		background: var(--sidebar-slate-700);
	}

	/* User Profile Section */
	.user-profile-section {
		position: relative;

		margin-top: auto;
	}

	.user-profile-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.25rem 0.5rem;
		max-height: 57px;
		background-color: var(--sidebar-slate-800);
		border: none;
		transition: all 0.3s ease;
		cursor: pointer;
		width: 100%;
		text-align: left;
		position: relative;
		z-index: 1;

		&:hover {
			background-color: var(--sidebar-slate-700);
		}

		&.collapsed {
			background-color: transparent;

			&:hover {
				background-color: var(--sidebar-slate-800);
			}
		}
	}

	.user-info {
		display: flex;
		flex-direction: column;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition:
			opacity 0.4s ease,
			clip-path 0.3s ease;

		&.expanded {
			opacity: 1;
			clip-path: inset(0 0 0 0);
		}

		&.collapsed {
			opacity: 0;
			clip-path: inset(0 100% 0 0);
		}
	}

	.user-avatar {
		flex-shrink: 0;

		.avatar-image {
			width: 2rem;
			height: 2rem;
			border-radius: 50%;
			object-fit: cover;
			border: 2px solid var(--sidebar-slate-700);
		}

		.avatar-placeholder {
			width: 2rem;
			height: 2rem;
			background: linear-gradient(135deg, var(--sidebar-accent), #9fffcb);
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			color: var(--sidebar-slate-950);
		}

		.avatar-initial {
			font-size: 0.875rem;
			font-weight: 600;
			color: var(--sidebar-slate-950);
			text-transform: uppercase;
		}
	}

	.user-info {
		.user-name {
			font-size: 0.875rem;
			font-weight: 600;
			color: var(--sidebar-slate-300);
			margin-bottom: 0.125rem;
		}

		.user-plan {
			font-size: 0.75rem;
			color: var(--sidebar-slate-400);
		}
	}

	.user-dropdown-menu {
		position: absolute;
		inset-inline: 0;
		inset-block-end: calc(100% + 0.5rem); /* replaces bottom + margin-bottom */
		background-color: var(--sidebar-slate-800);
		border: 1px solid var(--sidebar-slate-700);
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.3),
			0 2px 4px -1px rgba(0, 0, 0, 0.2);
		z-index: 100;
		overflow: hidden;
		width: 100%;
		--rise: 5px;
		--anim-dur: 200ms;
		transform: translateY(0);
		transform-origin: bottom center;
		max-height: 0;
		opacity: 0;
		padding: 0.25rem;
		transition:
			max-height 0.3s ease-in-out,
			opacity 0.25s ease-in-out,
			padding 0.3s ease-in-out;
		&.expanded {
			max-height: 400px;
			opacity: 1;
			padding: 0.25rem;
			pointer-events: auto;
			animation: dropdown-lift var(--anim-dur) ease-out 1;
		}

		&.collapsed {
			max-height: 0;
			opacity: 0;
			padding: 0;
		}
	}
	@keyframes dropdown-lift {
		0% {
			transform: translateY(0);
		}
		70% {
			transform: translateY(calc(-1 * var(--rise)));
		} /* up only */
		100% {
			transform: translateY(0);
		} /* settle back */
	}

	.user-dropdown-menu {
		display: flex !important;
		flex-direction: column !important;
		align-items: stretch !important;
	}

	.user-dropdown-menu .dropdown-item {
		display: flex !important;
		align-items: center !important;
		gap: 0.75rem !important;
		width: 100% !important;
		padding: 0.75rem !important;
		background: none !important;
		border: none !important;
		color: var(--sidebar-slate-300) !important;
		font-size: 0.875rem !important;
		cursor: pointer !important;
		transition: background-color 0.2s ease !important;
		text-align: left !important;
		margin-bottom: 0.25rem !important;

		&:hover {
			background-color: var(--sidebar-slate-700) !important;
		}

		&.logout {
			color: #ef4444 !important;
		}
	}

	/* Ensure sidebar doesn't clip dropdown when collapsed */
	:global(.sidebar:not(.open)) {
		overflow: visible !important;
	}

	/* Fix any unwanted pointer cursors */
	.sidebar-footer {
		cursor: default;
	}

	.sidebar-footer-content {
		cursor: default;
	}

	/* Only the profile card should have pointer cursor */
	.user-profile-section {
		cursor: default;
	}

	.user-profile-section .user-profile-card {
		cursor: pointer;
		pointer-events: auto;
		position: relative;
		z-index: 10;
	}

	/* Ensure no interference from dropdown */
	.user-dropdown-menu {
		pointer-events: auto;
		z-index: 5;
	}

	/* Make sure avatar and user-info don't interfere with clicks */
	.user-avatar,
	.user-info {
		pointer-events: none;
	}

	/* Completely override dropdown animation when sidebar is collapsed */
	:global(.sidebar:not(.open)) .user-dropdown-menu {
		transition: none !important;
		transform: none !important;
		animation: none !important;
	}

	/* Special positioning when sidebar is collapsed */
	:global(.sidebar.collapsed .user-dropdown-menu) {
		position: fixed !important;
		bottom: 5rem !important;
		left: 0.5rem !important;
		right: auto !important;
		width: 230px !important;
		z-index: 99999 !important;
		overflow: visible !important;
		transform: none !important;
		max-height: 0;
		opacity: 0;
		transition:
			max-height 0.3s ease-in-out,
			opacity 0.3s ease-in-out !important;
		pointer-events: none;
		/* Slate color styling */
		background-color: var(--sidebar-slate-800) !important;
		border: 1px solid var(--sidebar-slate-700) !important;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.3),
			0 2px 4px -1px rgba(0, 0, 0, 0.2) !important;
		padding: 0.25rem !important;
		display: flex !important;
		flex-direction: column !important;
		align-items: stretch !important;

		&.expanded {
			max-height: 400px !important;
			opacity: 1 !important;
			transform: none !important;
			padding: 0.25rem !important;
			pointer-events: auto !important;
		}

		&.collapsed {
			max-height: 0 !important;
			opacity: 0 !important;
			transform: none !important;
			padding: 0 !important;
		}

		.dropdown-item {
			display: flex !important;
			align-items: center !important;
			gap: 0.75rem !important;
			width: 100% !important;
			padding: 0.75rem !important;
			background: none !important;
			border: none !important;
			color: var(--sidebar-slate-300) !important;
			font-size: 0.875rem !important;
			cursor: pointer !important;
			transition: background-color 0.2s ease !important;
			text-align: left !important;
			margin-bottom: 0.25rem !important;

			&:hover {
				background-color: var(--sidebar-slate-700) !important;
			}

			&.logout {
				color: #ef4444 !important;
			}
		}

		.dropdown-divider {
			height: 1px;
			background-color: var(--sidebar-slate-700);
			margin: 0.25rem 0;
		}
	}
</style>

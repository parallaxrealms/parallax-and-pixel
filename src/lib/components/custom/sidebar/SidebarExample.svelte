<!-- SidebarExample.svelte - Example usage of the new sidebar system -->
<script lang="ts">
	import Sidebar from './Sidebar.svelte';
	import { sidebarActions, sidebarState } from '@parallaxrealms/stores-core';
	import { createSidebarConfig, sidebarConfigs } from '@parallaxrealms/utils-core';
	import { selectedTab } from '@parallaxrealms/stores-core';
	import {
		Home,
		Users,
		Settings,
		Palette,
		Database,
		Shield,
		Bell,
		HelpCircle,
		LogOut
	} from 'lucide-svelte';

	// Example 1: Basic usage with default config
	const basicItems = [
		{
			id: 'home',
			label: 'Dashboard',
			icon: Home,
			tabId: 'home', // This will trigger selectedTab.set('home')
			action: () => console.log('Navigate to home')
		},
		{
			id: 'users',
			label: 'Users',
			icon: Users,
			tabId: 'users', // This will trigger selectedTab.set('users')
			action: () => console.log('Navigate to users')
		},
		{
			id: 'settings',
			label: 'Settings',
			icon: Settings,
			tabId: 'user-settings', // This will trigger selectedTab.set('user-settings')
			action: () => console.log('Navigate to settings')
		}
	];

	// Example 2: Advanced usage with custom config
	// const customConfig = createSidebarConfig()
	// 	.width('15rem', '4rem')
	// 	.colors({
	// 		primary: 'var(--color-accent)',
	// 		background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-hover))'
	// 	})
	// 	.spacing({
	// 		padding: '0.5rem',
	// 		iconSize: '1.5rem'
	// 	})
	// 	.borderRadius({
	// 		item: 'var(--border-radius-lg)',
	// 		button: 'var(--border-radius-lg)'
	// 	})
	// 	.animations({
	// 		duration: '0.5s',
	// 		hoverScale: 1.05
	// 	})
	// 	.build();

	const advancedItems = [
		{
			id: 'dashboard',
			label: 'Dashboard',
			icon: Home,
			action: () => console.log('Navigate to dashboard'),
			badge: {
				text: 'New',
				variant: 'primary' as const
			}
		},
		{
			id: 'users',
			label: 'User Management',
			icon: Users,
			action: () => console.log('Navigate to users'),
			children: [
				{
					id: 'all-users',
					label: 'All Users',
					icon: Users,
					action: () => console.log('Navigate to all users')
				},
				{
					id: 'roles',
					label: 'Roles & Permissions',
					icon: Shield,
					action: () => console.log('Navigate to roles')
				}
			]
		},
		{
			id: 'admin',
			label: 'Administration',
			icon: Settings,
			adminOnly: true,
			children: [
				{
					id: 'theme-editor',
					label: 'Theme Editor',
					icon: Palette,
					action: () => console.log('Navigate to theme editor')
				},
				{
					id: 'database',
					label: 'Database',
					icon: Database,
					action: () => console.log('Navigate to database')
				}
			]
		},
		{
			id: 'notifications',
			label: 'Notifications',
			icon: Bell,
			action: () => console.log('Navigate to notifications'),
			badge: {
				text: '3',
				variant: 'error' as const
			}
		},
		{
			id: 'help',
			label: 'Help & Support',
			icon: HelpCircle,
			action: () => console.log('Navigate to help')
		}
	];

	const footerItems = [
		{
			id: 'logout',
			label: 'Logout',
			icon: LogOut,
			action: () => console.log('Logout')
		}
	];

	// Toggle sidebar for demo
	function toggleSidebar() {
		sidebarActions.toggle();
	}
</script>

<div class="sidebar-example">
	<div class="controls">
		<button onclick={toggleSidebar} class="toggle-btn"> Toggle Sidebar </button>
		<p class="controls-description">Click the button above to toggle all sidebars open/closed</p>
		<div class="debug-info">
			<p>Sidebar state: <strong>{$sidebarState.isOpen ? 'OPEN' : 'CLOSED'}</strong></p>
			<p>Selected tab: <strong>{$selectedTab}</strong></p>
		</div>
	</div>

	<div class="examples-container">
		<!-- Example 1: Basic Sidebar -->
		<div class="example-section">
			<h3 class="example-title">Basic Sidebar</h3>
			<p class="example-description">Default configuration with standard styling</p>
			<div class="sidebar-demo-container">
				<Sidebar items={basicItems} className="demo-sidebar" id="basic-sidebar" />
			</div>
		</div>

		<!-- Example 2: Advanced Sidebar -->
		<div class="example-section">
			<h3 class="example-title">Advanced Sidebar</h3>
			<p class="example-description">Custom colors, spacing, and animations with badges</p>
			<div class="sidebar-demo-container">
				<!-- <StreamlinedSidebar
					items={advancedItems}
					{footerItems}
					config={customConfig}
					className="demo-sidebar"
					id="advanced-sidebar"
				/> -->
			</div>
		</div>

		<!-- Example 3: Compact Sidebar -->
		<div class="example-section">
			<h3 class="example-title">Compact Sidebar</h3>
			<p class="example-description">Smaller, more condensed version</p>
			<div class="sidebar-demo-container">
				<Sidebar
					items={basicItems}
					config={sidebarConfigs.compact}
					className="demo-sidebar"
					id="compact-sidebar"
				/>
			</div>
		</div>

		<!-- Example 4: Rounded Sidebar -->
		<div class="example-section">
			<h3 class="example-title">Rounded Sidebar</h3>
			<p class="example-description">Rounded corners throughout</p>
			<div class="sidebar-demo-container">
				<Sidebar
					items={basicItems}
					config={sidebarConfigs.rounded}
					className="demo-sidebar"
					id="rounded-sidebar"
				/>
			</div>
		</div>
	</div>
</div>

<style>
	.sidebar-example {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--color-background);
	}

	.controls {
		padding: 1rem;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	.toggle-btn {
		padding: 0.5rem 1rem;
		background: var(--color-primary);
		color: black;
		border: none;
		border-radius: var(--border-radius-md);
		cursor: pointer;
		font-weight: 600;
	}

	.controls-description {
		margin-top: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.debug-info {
		margin-top: 1rem;
		padding: 0.75rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-md);
		font-size: 0.875rem;
	}

	.debug-info p {
		margin: 0;
		color: var(--color-text);
	}

	.examples-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
		padding: 2rem;
		flex: 1;
	}

	.example-section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-lg);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.example-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
	}

	.example-description {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.sidebar-demo-container {
		position: relative;
		height: 400px;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-md);
		overflow: hidden;
		background: var(--color-background);
	}

	:global(.demo-sidebar) {
		position: relative !important;
		height: 100% !important;
		transform: none !important;
		/* Remove width override to allow collapsed state */
	}
</style>

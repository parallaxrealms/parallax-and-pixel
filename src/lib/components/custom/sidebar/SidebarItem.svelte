<!-- SidebarItem.svelte - Rewritten with nested CSS -->
<script lang="ts">
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import type { SidebarItem as SidebarItemType, SidebarConfig } from '@parallaxrealms/pxp-types/core';

	let {
		item,
		isOpen = false,
		level = 0,
		activeItem = '',
		expandedItems = [],
		onItemClick = () => {},
		onToggleExpanded = () => {},
		onCollapseOthers = () => {},
		sidebarConfig = null
	} = $props<{
		item: SidebarItemType;
		isOpen?: boolean;
		level?: number;
		activeItem?: string;
		expandedItems?: string[];
		onItemClick?: (item: SidebarItemType) => void;
		onToggleExpanded?: (itemId: string) => void;
		onCollapseOthers?: () => void;
		sidebarConfig?: SidebarConfig | null;
	}>();

	// Derived state
	const hasChildren = $derived(item.children && item.children.length > 0);
	const isExpanded = $derived(expandedItems.includes(item.id));
	const isActive = $derived(activeItem === item.id);

	// Event handlers
	function handleClick(event: MouseEvent) {
		event.stopPropagation();
		console.log('🖱️ Item clicked:', item.id, 'hasChildren:', hasChildren);

		if (hasChildren) {
			// Parent item clicked - expand current and collapse others
			onCollapseOthers();
			onToggleExpanded(item.id);

			// Also navigate if the parent item has navigation
			if (item.tabId) {
				onItemClick(item);
			} else if (item.href) {
				goto(item.href);
			}
		} else {
			// Child item clicked - just navigate, don't collapse others
			if (item.tabId) {
				onItemClick(item);
			} else if (item.href) {
				goto(item.href);
			}
		}
	}

	function handleChildClick(childItem: SidebarItemType, event: MouseEvent) {
		event.stopPropagation();
		console.log('🖱️ Child item clicked:', childItem.id);

		if (childItem.tabId) {
			onItemClick(childItem, true); // Pass true to indicate this is a child item
		} else if (childItem.href) {
			goto(childItem.href);
		}

		// Don't collapse others when clicking child items - keep parent expanded
	}
</script>

<li class="sbi-container">
	<button
		class="sbi sbi-btn {isActive ? 'active' : ''} {isOpen ? 'expanded' : 'collapsed'}"
		onclick={handleClick}
		disabled={item.disabled}
		title={!isOpen ? item.label : undefined}
	>
		{#if item.icon}
			{@const IconComponent = item.icon}
			<IconComponent class="sbi-icon" />
		{/if}
		<div class="sbi-label-container {isOpen ? 'expanded' : 'collapsed'}">
			<span class="sbi-label">{item.label}</span>
			{#if hasChildren}
				<div
					class="sbi-chev-btn"
					onclick={(event) => {
						event.stopPropagation();
						console.log('🔽 Chevron clicked for:', item.id);
						onToggleExpanded(item.id);
					}}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							event.stopPropagation();
							console.log('🔽 Chevron key pressed for:', item.id);
							onToggleExpanded(item.id);
						}
					}}
					title={isExpanded ? 'Collapse' : 'Expand'}
					role="button"
					tabindex="0"
				>
					{#if isExpanded}
						<ChevronDown class="sbi-chevron" />
					{:else}
						<ChevronRight class="sbi-chevron" />
					{/if}
				</div>
			{/if}
		</div>
	</button>

	<!-- Children (always render for animation) -->
	{#if hasChildren && item.children && item.children.length > 0}
		<ul class="sb-children {isExpanded ? 'expanded' : 'collapsed'}">
			{#each item.children as childItem}
				<li class="sbi-container">
					<button
						class="sbi sbi-btn {activeItem === childItem.id ? 'active' : ''} {isOpen
							? 'expanded'
							: 'collapsed'}"
						onclick={(event) => handleChildClick(childItem, event)}
						disabled={childItem.disabled}
						title={!isOpen ? childItem.label : undefined}
					>
						{#if childItem.icon}
							{@const ChildIconComponent = childItem.icon}
							<ChildIconComponent class="sbi-icon" />
						{/if}
						<span class="sbi-label {isOpen ? 'expanded' : 'collapsed'}">{childItem.label}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</li>

<style>
	/* Slate color defaults for Parallax & Pixel */
	:root {
		--sbi-slate-950: #020617;
		--sbi-slate-900: #0f172a;
		--sbi-slate-800: #1e293b;
		--sbi-slate-700: #334155;
		--sbi-slate-400: #94a3b8;
		--sbi-accent: #00a5cf;
	}
	.sbi-container {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.sbi {
		display: flex;
		align-items: center;
		gap: var(--sbi-label-spacing);
		width: 100%;
		padding: 0.4rem 0.25rem 0.4rem 0.8rem;
		margin-left: -1px;
		height: var(--sbi-height);
		font-size: var(--sbi-font-size);
		font-weight: 500;
		cursor: pointer;
		text-align: left;
		position: relative;
		/* Prevent jitter during sidebar transitions */
		contain: layout;
		transform: translateZ(0);
		backface-visibility: hidden;
	}

	.sbi-btn {
		background-color: var(--sbi-bg);
		border-radius: var(--sbi-radius);
		color: var(--sbi-text);
		transition:
			background-color var(--sbi-duration) ease,
			color var(--sbi-duration) ease;

		&:hover {
			background-color: var(--sbi-hover-bg);
		}

		&.active {
			background-color: var(--sbi-active-bg);
			color: var(--sbi-active-text);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	:global(.sbi-icon) {
		width: var(--sbi-icon-size);
		height: var(--sbi-icon-size);
		flex-shrink: 0;
		color: var(--sbi-text);
	}

	:global(.sbi-btn.active .sbi-icon) {
		color: var(--sbi-active-text);
	}

	.sbi-label-container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		overflow: hidden;
		transition:
			opacity 0.4s ease-in-out,
			clip-path 0.3s ease-in-out;

		&.expanded {
			opacity: 1;
			clip-path: inset(0 0 0 0);
		}

		&.collapsed {
			opacity: 1;
			clip-path: inset(0 100% 0 0);
		}
	}

	.sbi-label {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sbi-chev-btn {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0;
		transition: background-color var(--sbi-duration) ease;

		&:hover {
			background-color: var(--sbi-slate-800);
			color: var(--sbi-text);
		}
	}

	:global(.sbi-chevron) {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		transition:
			transform var(--sbi-duration) ease,
			color var(--sbi-duration) ease;
		color: white;
		transform-origin: center;
	}

	/* Chevron rotation animation */
	:global(.sbi-btn .sbi-chevron) {
		transition: transform var(--sbi-duration) ease;
	}

	:global(.sbi-btn:has(.sbi-chevron) .sbi-chevron) {
		transform: rotate(-90deg);
	}

	:global(.sbi-btn.expanded:has(.sbi-chevron) .sbi-chevron) {
		transform: rotate(0deg);
	}

	:global(.sbi-btn:hover .sbi-chevron) {
		color: var(--sbi-text);
	}

	:global(.sbi-btn.active .sbi-chevron) {
		color: var(--sbi-active-text);

		&:hover {
			color: var(--sbi-text);
		}
	}

	/* Children container - Accordion style */
	.sb-children {
		list-style: none;
		padding: 0;
		margin: 0;
		overflow: hidden;
		transition:
			max-height var(--sbi-duration) ease-in-out,
			padding var(--sbi-duration) ease-in-out;
		max-height: 0;
		padding-left: 1rem !important;
		contain: layout;

		.sbi-btn {
			padding: 0.75rem !important;
			margin: 0.25rem !important;
			height: var(--sbi-height) !important;
			width: 98% !important;
		}

		.sbi-container {
			border-left: 1px solid var(--sbi-slate-700) !important;

			&:hover {
				border-left: 1px solid var(--sbi-accent) !important;
			}

			&:has(.sbi-btn.active) {
				border-left: 1px solid var(--sbi-accent) !important;
			}
		}
	}

	:global(.sidebar.open .sb-children) {
		transition:
			max-height 0.3s ease-in-out,
			padding 0.2s ease-in-out;
		padding-left: 1rem !important;

		&.expanded {
			max-height: 500px !important;
		}
		&.collapsed {
			max-height: 0 !important;
		}
	}
	:global(.sidebar.collapsed .sb-children) {
		transition:
			max-height 0.3s ease-in-out,
			padding 0.2s ease-in-out;
		padding-left: 0 !important;

		&.expanded {
			max-height: 500px !important;
		}
		&.collapsed {
			max-height: 0 !important;
		}

		.sbi-container {
			border-left: 1px solid transparent !important;
		}

		.sbi-btn {
			padding: 0.75rem !important;
			margin: 0.5rem 0.25rem 0.3rem 0rem !important;

			&:last-child {
				margin: 0.5rem 0.25rem 0rem 0rem !important;
			}
		}
	}
</style>

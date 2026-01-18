<script lang="ts" module>
	export interface ToggleFlipProps {
		isOpen: boolean;
		toggleSidebar: (event?: MouseEvent) => void;
		class?: string;
	}
</script>

<script lang="ts">
	import { PanelLeftClose, PanelLeft } from 'lucide-svelte';

	let { isOpen, toggleSidebar, class: className = '' }: ToggleFlipProps = $props();
</script>

<button
	class="toggle-flip-btn {className}"
	onclick={toggleSidebar}
	aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
	title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
>
	{#if isOpen}
		<PanelLeftClose class="toggle-flip-icon" />
	{:else}
		<PanelLeft class="toggle-flip-icon" />
	{/if}
</button>

<style>
	.toggle-flip-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		margin-top: 0.25rem;
		padding: 0.75rem;
		border-radius: var(--border-radius-md);
		background: transparent;
		border: none;
		color: var(--color-text);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.toggle-flip-btn:hover {
		background-color: var(--color-surface-hover);
		color: var(--color-text);
		transform: scale(1.05);
	}

	.toggle-flip-btn:active {
		transform: scale(0.95);
	}

	.toggle-flip-icon {
		width: 1.25rem;
		height: 1.25rem;
		transition: all var(--transition-fast);
	}
</style>

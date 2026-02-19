<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper, NodeViewContent } from 'svelte-tiptap';
	import { Trash2 } from 'lucide-svelte';

	const { node, editor, selected, deleteNode }: NodeViewProps = $props();

	let columns = $derived(node.attrs.columns || 2);
	let isEditable = $derived(editor?.isEditable ?? false);
</script>

<NodeViewWrapper
	class="my-4 multi-column-wrapper {selected ? 'ring-2' : ''}"
	style={selected ? 'ring-color: #00a5cf;' : ''}
>
	{#if isEditable}
		<div class="mb-2 flex items-center gap-2">
			<span class="font-terminal text-xs text-slate-400">
				{columns}-Column Layout
			</span>
			<div class="ml-auto flex gap-1">
				<button
					class="flex h-7 w-7 items-center justify-center border border-slate-600 bg-slate-800 text-red-400 transition-colors hover:text-red-300"
					onclick={deleteNode}
					title="Delete"
				>
					<Trash2 class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	{/if}

	<NodeViewContent
		class="multi-column-grid"
		style="--col-count: {columns};"
	/>
</NodeViewWrapper>

<style>
	:global(.multi-column-wrapper) {
		position: relative;
	}

	:global(.multi-column-grid) {
		width: 100%;
	}

	/* The contentDOMElement (direct child) is where column nodes actually live */
	:global(.multi-column-grid > div) {
		display: grid;
		grid-template-columns: repeat(var(--col-count, 2), 1fr);
		gap: 1rem;
	}
</style>

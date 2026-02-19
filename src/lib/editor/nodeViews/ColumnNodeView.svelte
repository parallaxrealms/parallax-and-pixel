<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper, NodeViewContent } from 'svelte-tiptap';

	const { editor }: NodeViewProps = $props();

	let isEditable = $derived(editor?.isEditable ?? false);
</script>

<NodeViewWrapper class="column-node {isEditable ? 'editing' : ''}">
	<NodeViewContent class="column-content" />
</NodeViewWrapper>

<style>
	:global(.column-node.editing) {
		border: 1px dashed rgba(100, 116, 139, 0.4);
		padding: 0.5rem;
		min-height: 3rem;
	}

	:global(.column-node:not(.editing)) {
		min-height: 1rem;
	}

	:global(.column-content) {
		min-height: 1.5rem;
	}
</style>

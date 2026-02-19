<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper } from 'svelte-tiptap';
	import ImageComparisonSlider from '$lib/components/custom/media/ImageComparisonSlider.svelte';
	import MediaPickerDialog from '$lib/editor/components/MediaPickerDialog.svelte';
	import { Pencil, Trash2, Check, Image as ImageIcon } from 'lucide-svelte';

	const { node, editor, selected, deleteNode, updateAttributes }: NodeViewProps = $props();

	let editing = $state(false);
	let beforeImage = $state('');
	let afterImage = $state('');
	let beforeLabel = $state('Before');
	let afterLabel = $state('After');

	// Sync from node attrs when editing starts
	$effect(() => {
		if (editing) {
			beforeImage = node.attrs.beforeImage;
			afterImage = node.attrs.afterImage;
			beforeLabel = node.attrs.beforeLabel;
			afterLabel = node.attrs.afterLabel;
		}
	});

	function saveEdits() {
		updateAttributes({
			beforeImage,
			afterImage,
			beforeLabel,
			afterLabel
		});
		editing = false;
	}

	// MediaPicker state
	let mediaPickerOpen = $state(false);
	let mediaPickerTarget = $state<'before' | 'after'>('before');

	function openMediaPicker(target: 'before' | 'after') {
		mediaPickerTarget = target;
		mediaPickerOpen = true;
	}

	function handleMediaSelect(url: string) {
		if (mediaPickerTarget === 'before') {
			beforeImage = url;
		} else {
			afterImage = url;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdits();
		}
	}
</script>

<NodeViewWrapper
	class="my-4 {selected ? 'ring-2' : ''}"
	style={selected ? 'ring-color: #00a5cf;' : ''}
>
	{#if editor?.isEditable}
		<!-- Editor toolbar -->
		<div class="mb-2 flex items-center gap-2">
			<span class="font-terminal text-xs text-slate-400">Comparison Slider</span>
			<div class="ml-auto flex gap-1">
				{#if editing}
					<button
						class="flex h-7 w-7 items-center justify-center border border-slate-600 bg-slate-800 text-slate-300 transition-colors hover:text-white"
						onclick={saveEdits}
						title="Save"
					>
						<Check class="h-3.5 w-3.5" />
					</button>
				{:else}
					<button
						class="flex h-7 w-7 items-center justify-center border border-slate-600 bg-slate-800 text-slate-300 transition-colors hover:text-white"
						onclick={() => (editing = true)}
						title="Edit"
					>
						<Pencil class="h-3.5 w-3.5" />
					</button>
				{/if}
				<button
					class="flex h-7 w-7 items-center justify-center border border-slate-600 bg-slate-800 text-red-400 transition-colors hover:text-red-300"
					onclick={deleteNode}
					title="Delete"
				>
					<Trash2 class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>

		{#if editing}
			<!-- Config panel -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="mb-3 space-y-2 border border-slate-700 bg-slate-900 p-3"
				onkeydown={(e) => { handleKeyDown(e); e.stopPropagation(); }}
				onkeyup={(e) => e.stopPropagation()}
				onkeypress={(e) => e.stopPropagation()}
				onmousedown={(e) => e.stopPropagation()}
				onclick={(e) => e.stopPropagation()}
			>
				<div class="grid grid-cols-2 gap-2">
					<div>
						<label class="mb-1 block font-terminal text-xs text-slate-400">Before Image URL</label>
						<div class="flex gap-1">
							<input
								type="text"
								bind:value={beforeImage}
								placeholder="/preview/before.webp"
								class="flex-1 border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-200"
							/>
							<button
								class="flex items-center border border-slate-600 bg-slate-800 px-2 py-1 text-slate-300 hover:text-white"
								onclick={() => openMediaPicker('before')}
								title="Browse Media"
							>
								<ImageIcon class="h-3 w-3" />
							</button>
						</div>
					</div>
					<div>
						<label class="mb-1 block font-terminal text-xs text-slate-400">After Image URL</label>
						<div class="flex gap-1">
							<input
								type="text"
								bind:value={afterImage}
								placeholder="/preview/after.webp"
								class="flex-1 border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-200"
							/>
							<button
								class="flex items-center border border-slate-600 bg-slate-800 px-2 py-1 text-slate-300 hover:text-white"
								onclick={() => openMediaPicker('after')}
								title="Browse Media"
							>
								<ImageIcon class="h-3 w-3" />
							</button>
						</div>
					</div>
					<div>
						<label class="mb-1 block font-terminal text-xs text-slate-400">Before Label</label>
						<input
							type="text"
							bind:value={beforeLabel}
							class="w-full border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-200"
						/>
					</div>
					<div>
						<label class="mb-1 block font-terminal text-xs text-slate-400">After Label</label>
						<input
							type="text"
							bind:value={afterLabel}
							class="w-full border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-200"
						/>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Actual component -->
	{#if node.attrs.beforeImage && node.attrs.afterImage}
		<ImageComparisonSlider
			beforeImage={node.attrs.beforeImage}
			afterImage={node.attrs.afterImage}
			beforeLabel={node.attrs.beforeLabel}
			afterLabel={node.attrs.afterLabel}
			initialPosition={node.attrs.initialPosition}
		/>
	{:else}
		<div class="flex h-48 items-center justify-center border border-dashed border-slate-600 bg-slate-900/50">
			<p class="font-terminal text-sm text-slate-500">
				Click edit to configure comparison slider images
			</p>
		</div>
	{/if}
</NodeViewWrapper>

<MediaPickerDialog bind:open={mediaPickerOpen} onSelect={handleMediaSelect} />

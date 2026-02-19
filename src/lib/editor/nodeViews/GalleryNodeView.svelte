<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper } from 'svelte-tiptap';
	import ThumbnailGallery from '$lib/components/custom/media/ThumbnailGallery.svelte';
	import MediaPickerDialog from '$lib/editor/components/MediaPickerDialog.svelte';
	import { Pencil, Trash2, Check, Plus, X, Image as ImageIcon } from 'lucide-svelte';

	const { node, editor, selected, deleteNode, updateAttributes }: NodeViewProps = $props();

	let editing = $state(false);

	// Parse the images JSON string from node attrs
	function parseImages(): { url: string; thumbnail?: string; caption?: string; alt?: string }[] {
		try {
			const parsed = JSON.parse(node.attrs.images || '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	let images = $derived(parseImages());

	// Editable state for config panel
	let editImages = $state<{ url: string; caption: string }[]>([]);

	function startEditing() {
		editImages = images.map((img) => ({
			url: img.url || '',
			caption: img.caption || ''
		}));
		if (editImages.length === 0) {
			editImages = [{ url: '', caption: '' }];
		}
		editing = true;
	}

	function addImageRow() {
		editImages = [...editImages, { url: '', caption: '' }];
	}

	function removeImageRow(index: number) {
		editImages = editImages.filter((_, i) => i !== index);
	}

	// MediaPicker state
	let mediaPickerOpen = $state(false);
	let mediaPickerTargetIndex = $state(-1);

	function openMediaPicker(index: number) {
		mediaPickerTargetIndex = index;
		mediaPickerOpen = true;
	}

	function handleMediaSelect(url: string) {
		if (mediaPickerTargetIndex >= 0 && mediaPickerTargetIndex < editImages.length) {
			editImages[mediaPickerTargetIndex].url = url;
			editImages = [...editImages];
		}
	}

	function saveEdits() {
		const filtered = editImages.filter((img) => img.url.trim() !== '');
		updateAttributes({
			images: JSON.stringify(filtered)
		});
		editing = false;
	}
</script>

<NodeViewWrapper
	class="my-4 {selected ? 'ring-2' : ''}"
	style={selected ? 'ring-color: #00a5cf;' : ''}
>
	{#if editor?.isEditable}
		<!-- Editor toolbar -->
		<div class="mb-2 flex items-center gap-2">
			<span class="font-terminal text-xs text-slate-400">
				Thumbnail Gallery ({images.length} images)
			</span>
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
						onclick={startEditing}
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
			<!-- Config panel - stop all event propagation to prevent ProseMirror from intercepting -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="mb-3 space-y-2 border border-slate-700 bg-slate-900 p-3"
				onmousedown={(e) => e.stopPropagation()}
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				onkeyup={(e) => e.stopPropagation()}
				onkeypress={(e) => e.stopPropagation()}
			>
				{#each editImages as img, i}
					<div class="flex items-start gap-2">
						<div class="flex-1 space-y-1">
							<div class="flex gap-1">
								<input
									type="text"
									bind:value={img.url}
									placeholder="Image URL..."
									class="flex-1 border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-200"
								/>
								<button
									class="flex items-center gap-1 border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-300 hover:text-white"
									onclick={() => openMediaPicker(i)}
									title="Browse Media"
								>
									<ImageIcon class="h-3 w-3" />
								</button>
							</div>
							<input
								type="text"
								bind:value={img.caption}
								placeholder="Caption (optional)..."
								class="w-full border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-200"
							/>
						</div>
						<button
							class="mt-1 flex h-6 w-6 items-center justify-center text-slate-500 hover:text-red-400"
							onclick={() => removeImageRow(i)}
							title="Remove"
						>
							<X class="h-3.5 w-3.5" />
						</button>
					</div>
				{/each}
				<button
					class="flex items-center gap-1 font-terminal text-xs transition-colors hover:text-white"
					style="color: #00a5cf;"
					onclick={addImageRow}
				>
					<Plus class="h-3 w-3" />
					Add Image
				</button>
			</div>
		{/if}
	{/if}

	<!-- Actual component -->
	{#if images.length > 0}
		<ThumbnailGallery
			{images}
			columns={node.attrs.columns}
			aspectRatio={node.attrs.aspectRatio}
			editable={editor?.isEditable ?? false}
		/>
	{:else}
		<div class="flex h-36 items-center justify-center border border-dashed border-slate-600 bg-slate-900/50">
			<p class="font-terminal text-sm text-slate-500">
				Click edit to add gallery images
			</p>
		</div>
	{/if}
</NodeViewWrapper>

<MediaPickerDialog bind:open={mediaPickerOpen} onSelect={handleMediaSelect} />

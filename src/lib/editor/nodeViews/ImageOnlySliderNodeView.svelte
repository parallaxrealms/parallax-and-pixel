<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper } from 'svelte-tiptap';
	import ImageOnlySlider from '$lib/components/custom/slider/ImageOnlySlider.svelte';
	import MediaPickerDialog from '$lib/editor/components/MediaPickerDialog.svelte';
	import { Pencil, Trash2, Check, Plus, X, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-svelte';

	const { node, editor, selected, deleteNode, updateAttributes }: NodeViewProps = $props();

	let editing = $state(false);

	type SlideData = { src: string; alt: string; caption: string };

	function parseSlides(): SlideData[] {
		try {
			const parsed = JSON.parse(node.attrs.slides || '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	let slides = $derived(parseSlides());

	let editSlides = $state<SlideData[]>([]);
	let editAutoplay = $state(true);
	let editInterval = $state(4500);
	let editShowArrows = $state(true);
	let editShowDots = $state(true);

	// MediaPicker state
	let mediaPickerOpen = $state(false);
	let mediaPickerTargetIndex = $state(-1);

	function startEditing() {
		editSlides = slides.length > 0
			? slides.map((s) => ({ src: s.src || '', alt: s.alt || '', caption: s.caption || '' }))
			: [{ src: '', alt: '', caption: '' }];
		editAutoplay = node.attrs.autoplay !== false;
		editInterval = node.attrs.interval || 4500;
		editShowArrows = node.attrs.showArrows !== false;
		editShowDots = node.attrs.showDots !== false;
		editing = true;
	}

	function addSlideRow() {
		editSlides = [...editSlides, { src: '', alt: '', caption: '' }];
	}

	function removeSlideRow(index: number) {
		editSlides = editSlides.filter((_, i) => i !== index);
	}

	function moveSlide(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= editSlides.length) return;
		const copy = [...editSlides];
		[copy[index], copy[target]] = [copy[target], copy[index]];
		editSlides = copy;
	}

	function openMediaPicker(index: number) {
		mediaPickerTargetIndex = index;
		mediaPickerOpen = true;
	}

	function handleMediaSelect(url: string) {
		if (mediaPickerTargetIndex >= 0 && mediaPickerTargetIndex < editSlides.length) {
			editSlides[mediaPickerTargetIndex].src = url;
			editSlides = [...editSlides]; // trigger reactivity
		}
	}

	function saveEdits() {
		const filtered = editSlides.filter((s) => s.src.trim() !== '');
		updateAttributes({
			slides: JSON.stringify(filtered),
			autoplay: editAutoplay,
			interval: editInterval,
			showArrows: editShowArrows,
			showDots: editShowDots
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
				Image Slider ({slides.length} slides)
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
				class="mb-3 space-y-3 border border-slate-700 bg-slate-900 p-3"
				onmousedown={(e) => e.stopPropagation()}
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				onkeyup={(e) => e.stopPropagation()}
				onkeypress={(e) => e.stopPropagation()}
			>
				<!-- Slides list -->
				{#each editSlides as slide, i}
					<div class="flex items-start gap-2 border-b border-slate-800 pb-2">
						<div class="flex flex-col gap-0.5">
							<button
								class="text-slate-500 hover:text-white disabled:opacity-30"
								onclick={() => moveSlide(i, -1)}
								disabled={i === 0}
								title="Move up"
							>
								<ChevronUp class="h-3 w-3" />
							</button>
							<button
								class="text-slate-500 hover:text-white disabled:opacity-30"
								onclick={() => moveSlide(i, 1)}
								disabled={i === editSlides.length - 1}
								title="Move down"
							>
								<ChevronDown class="h-3 w-3" />
							</button>
						</div>
						<div class="flex-1 space-y-1">
							<div class="flex gap-1">
								<input
									type="text"
									bind:value={slide.src}
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
								bind:value={slide.alt}
								placeholder="Alt text (optional)..."
								class="w-full border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-200"
							/>
							<input
								type="text"
								bind:value={slide.caption}
								placeholder="Caption (optional)..."
								class="w-full border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-200"
							/>
						</div>
						<button
							class="mt-1 flex h-6 w-6 items-center justify-center text-slate-500 hover:text-red-400"
							onclick={() => removeSlideRow(i)}
							title="Remove"
						>
							<X class="h-3.5 w-3.5" />
						</button>
					</div>
				{/each}

				<button
					class="flex items-center gap-1 font-terminal text-xs transition-colors hover:text-white"
					style="color: #00a5cf;"
					onclick={addSlideRow}
				>
					<Plus class="h-3 w-3" />
					Add Slide
				</button>

				<!-- Settings -->
				<div class="flex flex-wrap items-center gap-4 border-t border-slate-800 pt-2">
					<label class="flex items-center gap-1.5 font-terminal text-xs text-slate-400">
						<input type="checkbox" bind:checked={editAutoplay} class="accent-cyan-500" />
						Autoplay
					</label>
					{#if editAutoplay}
						<label class="flex items-center gap-1.5 font-terminal text-xs text-slate-400">
							Interval
							<input
								type="number"
								bind:value={editInterval}
								min="1000"
								max="30000"
								step="500"
								class="w-20 border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
							/>
							ms
						</label>
					{/if}
					<label class="flex items-center gap-1.5 font-terminal text-xs text-slate-400">
						<input type="checkbox" bind:checked={editShowArrows} class="accent-cyan-500" />
						Arrows
					</label>
					<label class="flex items-center gap-1.5 font-terminal text-xs text-slate-400">
						<input type="checkbox" bind:checked={editShowDots} class="accent-cyan-500" />
						Dots
					</label>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Actual component -->
	{#if slides.length > 0}
		<ImageOnlySlider
			{slides}
			auto={node.attrs.autoplay !== false}
			interval={node.attrs.interval || 4500}
			showArrows={node.attrs.showArrows !== false}
			showDots={node.attrs.showDots !== false}
		/>
	{:else}
		<div class="flex h-48 items-center justify-center border border-dashed border-slate-600 bg-slate-900/50">
			<p class="font-terminal text-sm text-slate-500">
				Click edit to add slider images
			</p>
		</div>
	{/if}
</NodeViewWrapper>

<MediaPickerDialog bind:open={mediaPickerOpen} onSelect={handleMediaSelect} />

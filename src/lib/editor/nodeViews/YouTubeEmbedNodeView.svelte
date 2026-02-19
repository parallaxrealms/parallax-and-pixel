<script lang="ts">
	import type { NodeViewProps } from '@tiptap/core';
	import { NodeViewWrapper } from 'svelte-tiptap';
	import { Pencil, Trash2, Check } from 'lucide-svelte';

	const { node, editor, selected, deleteNode, updateAttributes }: NodeViewProps = $props();

	let editing = $state(false);
	let urlInput = $state('');

	function extractVideoId(url: string): string {
		if (!url) return '';
		// youtube.com/watch?v=ID
		let match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
		if (match) return match[1];
		// youtu.be/ID
		match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
		if (match) return match[1];
		// youtube.com/embed/ID
		match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
		if (match) return match[1];
		// youtube.com/shorts/ID
		match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
		if (match) return match[1];
		// Bare video ID
		if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
		return '';
	}

	function startEditing() {
		urlInput = node.attrs.url || '';
		editing = true;
	}

	function saveEdits() {
		const videoId = extractVideoId(urlInput);
		updateAttributes({ url: urlInput, videoId });
		editing = false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdits();
		}
	}

	let videoId = $derived(node.attrs.videoId || extractVideoId(node.attrs.url || ''));
</script>

<NodeViewWrapper
	class="my-4 {selected ? 'ring-2' : ''}"
	style={selected ? 'ring-color: #00a5cf;' : ''}
>
	{#if editor?.isEditable}
		<!-- Editor toolbar -->
		<div class="mb-2 flex items-center gap-2">
			<span class="font-terminal text-xs text-slate-400">YouTube Embed</span>
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
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="mb-3 space-y-2 border border-slate-700 bg-slate-900 p-3"
				onkeydown={(e) => { handleKeyDown(e); e.stopPropagation(); }}
				onkeyup={(e) => e.stopPropagation()}
				onkeypress={(e) => e.stopPropagation()}
				onmousedown={(e) => e.stopPropagation()}
				onclick={(e) => e.stopPropagation()}
			>
				<label class="mb-1 block font-terminal text-xs text-slate-400">
					YouTube URL
					<input
						type="text"
						bind:value={urlInput}
						placeholder="https://www.youtube.com/watch?v=..."
						class="mt-1 w-full border border-slate-600 bg-slate-800 px-2 py-1 font-terminal text-xs text-slate-200"
					/>
				</label>
				<p class="font-terminal text-[10px] text-slate-500">
					Supports youtube.com/watch, youtu.be, youtube.com/shorts, youtube.com/embed
				</p>
			</div>
		{/if}
	{/if}

	<!-- Actual embed -->
	{#if videoId}
		<div class="relative w-full" style="aspect-ratio: 16/9;">
			<iframe
				src="https://www.youtube.com/embed/{videoId}"
				title="YouTube video"
				frameborder="0"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowfullscreen
				class="absolute inset-0 h-full w-full"
			></iframe>
		</div>
	{:else}
		<div class="flex h-48 items-center justify-center border border-dashed border-slate-600 bg-slate-900/50">
			<p class="font-terminal text-sm text-slate-500">
				Click edit to add a YouTube URL
			</p>
		</div>
	{/if}
</NodeViewWrapper>

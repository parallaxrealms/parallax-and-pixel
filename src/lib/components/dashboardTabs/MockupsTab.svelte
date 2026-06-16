<script lang="ts">
	/**
	 * Mockups tab — entry point for the mockup creator, ported/reworked from the
	 * 9realms VULCAN mockups tab for Parallax & Pixel.
	 *
	 * Hosts a Library/Creator sub-nav:
	 *  - Library: grid/list of saved public.mockup_projects (view/edit/download/delete).
	 *  - Creator: the fabric.js editor (blank for "new", or seeded with a project to edit).
	 *
	 * Both Creator exits (back + saved) call `oncomplete`, which returns to the
	 * Library and forces a refresh so the new/updated project appears.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { MockupProject } from '$lib/types/mockups';
	import { LayoutTemplate, Library, Plus } from 'lucide-svelte';
	import MockupLibrary from './mockups/MockupLibrary.svelte';
	import MockupCreator from './mockups/MockupCreator.svelte';

	let { supabase } = $props<{ supabase: SupabaseClient }>();

	type SubView = 'library' | 'creator';
	let subView = $state<SubView>('library');
	let mockupToEdit = $state<MockupProject | null>(null);

	// Bump to force-remount the Library (and re-run its load) after a save/edit.
	let libraryKey = $state(0);

	function openNew() {
		mockupToEdit = null;
		subView = 'creator';
	}

	function openEdit(mockup: MockupProject) {
		mockupToEdit = mockup;
		subView = 'creator';
	}

	function backToLibrary() {
		mockupToEdit = null;
		subView = 'library';
		libraryKey += 1; // refresh the saved-projects list
	}
</script>

<div class="mx-auto max-w-6xl">
	<header class="mb-6 flex items-center gap-3">
		<LayoutTemplate class="h-6 w-6 text-accent-primary" />
		<div>
			<h1 class="text-2xl font-bold text-white">Mockups</h1>
			<p class="mt-0.5 text-sm text-slate-400">
				Design product mockups from Media Library or device images, then export.
			</p>
		</div>
	</header>

	<!-- Sub-nav (native sharp tabs) -->
	<div class="mb-6 flex border-b border-slate-800">
		<button
			type="button"
			class="inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition {subView ===
			'library'
				? 'border-accent-primary text-accent-primary'
				: 'border-transparent text-slate-400 hover:text-slate-200'}"
			onclick={backToLibrary}
		>
			<Library class="h-4 w-4" /> Library
		</button>
		<button
			type="button"
			class="inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition {subView ===
			'creator'
				? 'border-accent-primary text-accent-primary'
				: 'border-transparent text-slate-400 hover:text-slate-200'}"
			onclick={openNew}
		>
			<Plus class="h-4 w-4" /> {mockupToEdit ? 'Editing' : 'New mockup'}
		</button>
	</div>

	{#if subView === 'library'}
		{#key libraryKey}
			<MockupLibrary {supabase} oneditMockup={openEdit} onnew={openNew} />
		{/key}
	{:else}
		<!-- Creator is full-height; give it room to lay out its canvas + panels. -->
		<div class="h-[calc(100vh-16rem)] min-h-[640px] border border-slate-800">
			<MockupCreator {supabase} {mockupToEdit} oncomplete={backToLibrary} />
		</div>
	{/if}
</div>

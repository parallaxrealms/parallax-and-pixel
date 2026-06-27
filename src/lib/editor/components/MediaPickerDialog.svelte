<script lang="ts">
	import { MediaPicker } from '@parallaxrealms/pxp-components/editor';
	import { getEditorContext } from '@parallaxrealms/pxp-components/editor';
	import type { SupabaseClient } from '@supabase/supabase-js';

	interface Props {
		open: boolean;
		onSelect: (url: string) => void;
		// Optional explicit overrides for use OUTSIDE the editor's context scope
		// (e.g. the page sidebar's background-image picker, which is a sibling of
		// <EdraEditor> and so cannot read its context). When omitted, these fall
		// back to the editor context set by <EdraEditor> for its descendants.
		supabase?: SupabaseClient;
		user?: unknown;
		siteId?: string;
		mediaTable?: string;
		mediaBucket?: string;
	}

	let {
		open = $bindable(false),
		onSelect,
		supabase,
		user,
		siteId,
		mediaTable,
		mediaBucket
	}: Props = $props();

	let ctx = $state(getEditorContext());

	// Resolve config from explicit props first, then the editor context.
	let cfg = $derived({
		supabase: supabase ?? ctx?.supabase,
		user: user ?? ctx?.user,
		siteId: siteId ?? ctx?.siteId,
		mediaTable: mediaTable ?? ctx?.mediaTable,
		mediaBucket: mediaBucket ?? ctx?.mediaBucket
	});

	// Re-read context when dialog opens (in case it was set after mount)
	$effect(() => {
		if (open && !ctx) {
			ctx = getEditorContext();
		}
	});

	function handleSelect(url: string) {
		onSelect(url);
		open = false;
	}

	function handleCancel() {
		open = false;
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			open = false;
		}
	}
</script>

{#if open && cfg.supabase}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
		onclick={onBackdropClick}
	>
		<div
			class="w-full max-w-7xl rounded border border-slate-700 bg-slate-900 p-4 shadow-2xl"
			style="max-height: 80vh;"
		>
			<h3 class="mb-3 font-terminal text-sm font-semibold text-slate-200">
				Browse Media
			</h3>
			<div style="height: 60vh;">
				<MediaPicker
					supabase={cfg.supabase}
					user={cfg.user}
					siteId={cfg.siteId}
					mediaTable={cfg.mediaTable}
					mediaBucket={cfg.mediaBucket}
					onSelect={handleSelect}
					onCancel={handleCancel}
				/>
			</div>
		</div>
	</div>
{/if}

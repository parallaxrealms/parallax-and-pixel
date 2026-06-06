<script lang="ts">
	import { MediaPicker } from '@parallaxrealms/pxp-components/editor';
	import { getEditorContext } from '@parallaxrealms/pxp-components/editor';

	interface Props {
		open: boolean;
		onSelect: (url: string) => void;
	}

	let { open = $bindable(false), onSelect }: Props = $props();

	let ctx = $state(getEditorContext());

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

{#if open && ctx}
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
					supabase={ctx.supabase}
					user={ctx.user}
					siteId={ctx.siteId}
					mediaTable={ctx.mediaTable}
					mediaBucket={ctx.mediaBucket}
					onSelect={handleSelect}
					onCancel={handleCancel}
				/>
			</div>
		</div>
	</div>
{/if}

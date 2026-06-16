<script lang="ts">
	// Full-screen DAEDALUS viewer in a dialog, for the embedded "View in DAEDALUS"
	// flow. The inner wrapper carries `.theme-daedalus` so the cobalt mode tokens
	// re-scope here even though the host page (and the portaled dialog) sit under
	// another theme on <html>.
	import * as Dialog from '$lib/components/shadcn/ui/dialog';
	import DaedalusViewer from './DaedalusViewer.svelte';
	import type { SceneDoc } from './schema';

	let { open = $bindable(false), scene }: { open?: boolean; scene: SceneDoc | null } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="h-[90vh] max-h-[90vh] w-[95vw] max-w-[95vw] overflow-hidden border-slate-800 bg-slate-950 p-0"
	>
		{#if scene}
			<div class="dq-wrap theme-daedalus">
				<div class="dq-title">{scene.name}</div>
				<div class="dq-stage">
					{#key scene.id}
						<DaedalusViewer {scene} editable={false} />
					{/key}
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<style>
	.dq-wrap {
		display: flex;
		flex: 1;
		min-height: 0;
		height: 100%;
		flex-direction: column;
		background: #020617; /* slate-950 */
	}
	.dq-title {
		flex: none;
		padding: 0.6rem 1rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0; /* slate-200 */
		border-bottom: 1px solid #1e293b; /* slate-800 */
	}
	.dq-stage {
		flex: 1;
		min-height: 0;
		display: flex;
	}
	.dq-stage > :global(*) {
		flex: 1;
		min-width: 0;
	}
</style>

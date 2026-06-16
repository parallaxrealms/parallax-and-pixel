<script lang="ts">
	// Single-group inspector — lives in the viewer's right panel when a graph group
	// boundary is selected in the studio. Mutates the shared $state scene live
	// (autosaved). Deleting a group removes only the boundary, not its member nodes.
	import { Trash2 } from 'lucide-svelte';
	import type { SceneDoc } from './schema';

	let { scene, id }: { scene: SceneDoc; id: string } = $props();

	let group = $derived(scene.data.groups?.find((g) => g.id === id));

	function del() {
		scene.data.groups = (scene.data.groups ?? []).filter((g) => g.id !== id);
	}
</script>

{#if group}
	<div class="insp">
		<label class="f">
			<span>Label</span>
			<input bind:value={group.label} placeholder="Group label" />
		</label>
		<label class="f color-f">
			<span>Color</span>
			<input
				type="color"
				value={group.color ?? '#4d7cff'}
				oninput={(e) => (group.color = e.currentTarget.value)}
			/>
		</label>
		<button class="del" onclick={del}><Trash2 size={13} strokeWidth={2} /> Delete group</button>
	</div>
{/if}

<style>
	.insp {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		font-size: 0.8rem;
	}
	.f {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.f span {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #93a4c4;
	}
	.color-f {
		flex: none;
	}
	input {
		background: rgba(5, 10, 20, 0.7);
		border: 1px solid rgba(0, 165, 207, 0.22);
		color: #f1f5f9;
		padding: 0.3rem 0.45rem;
		font-size: 0.8rem;
		width: 100%;
	}
	input[type='color'] {
		width: 36px;
		height: 30px;
		padding: 0;
		cursor: pointer;
	}
	input:focus {
		outline: none;
		border-color: var(--accent-primary, #00a5cf);
	}
	.del {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		align-self: flex-start;
		margin-top: 0.2rem;
		padding: 0.3rem 0.6rem;
		font-size: 0.72rem;
		color: #f87171;
		background: rgba(248, 113, 113, 0.08);
		border: 1px solid rgba(248, 113, 113, 0.3);
		cursor: pointer;
	}
	.del:hover {
		background: rgba(248, 113, 113, 0.16);
	}
</style>

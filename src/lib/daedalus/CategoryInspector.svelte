<script lang="ts">
	// Single-category inspector (Bar / Pie). Mutates the shared $state scene live.
	import { Trash2 } from 'lucide-svelte';
	import type { SceneDoc } from './schema';

	let { scene, id, onDelete }: { scene: SceneDoc; id: string; onDelete: () => void } = $props();

	let cat = $derived(scene.data.categories?.find((c) => c.id === id));

	function del() {
		scene.data.categories = (scene.data.categories ?? []).filter((c) => c.id !== id);
		onDelete();
	}
</script>

{#if cat}
	<div class="insp">
		<label class="f">
			<span>Label</span>
			<input bind:value={cat.label} placeholder="Category label" />
		</label>
		<div class="row2">
			<label class="f color-f">
				<span>Color</span>
				<input
					type="color"
					value={cat.color ?? '#4d7cff'}
					oninput={(e) => (cat.color = e.currentTarget.value)}
				/>
			</label>
			<label class="f grow">
				<span>Value</span>
				<input
					type="number"
					value={cat.value}
					oninput={(e) => (cat.value = Number(e.currentTarget.value) || 0)}
				/>
			</label>
		</div>
		<button class="del" onclick={del}><Trash2 size={13} strokeWidth={2} /> Delete</button>
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
	.row2 {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}
	.color-f {
		flex: none;
	}
	.grow {
		flex: 1;
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

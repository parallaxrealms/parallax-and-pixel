<script lang="ts">
	// Single-edge inspector — lives in the viewer's right panel when a graph edge
	// is selected in the studio. Mutates the shared $state scene live (autosaved).
	// edgeKey is "source>target".
	import { Trash2 } from 'lucide-svelte';
	import type { SceneDoc, EdgeKind } from './schema';

	let { scene, edgeKey, onDelete }: { scene: SceneDoc; edgeKey: string; onDelete: () => void } =
		$props();

	let edge = $derived(scene.data.edges?.find((e) => e.source + '>' + e.target === edgeKey));

	const KINDS: EdgeKind[] = ['sync', 'async', 'event', 'data', 'dep'];

	function del() {
		scene.data.edges = (scene.data.edges ?? []).filter(
			(e) => e.source + '>' + e.target !== edgeKey
		);
		onDelete();
	}
</script>

{#if edge}
	<div class="insp">
		<label class="f">
			<span>Kind</span>
			<select
				value={edge.kind ?? ''}
				onchange={(e) => (edge.kind = e.currentTarget.value || undefined)}
			>
				<option value="">— default —</option>
				{#each KINDS as k (k)}
					<option value={k}>{k}</option>
				{/each}
			</select>
		</label>
		<label class="f">
			<span>Label</span>
			<input
				value={edge.label ?? ''}
				oninput={(e) => (edge.label = e.currentTarget.value || undefined)}
				placeholder="optional"
			/>
		</label>
		<label class="f checkbox-f">
			<input
				type="checkbox"
				checked={edge.animated ?? false}
				onchange={(e) => (edge.animated = e.currentTarget.checked)}
			/>
			<span>Animated flow</span>
		</label>
		<button class="del" onclick={del}><Trash2 size={13} strokeWidth={2} /> Delete edge</button>
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
	.checkbox-f {
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
	}
	.checkbox-f span {
		text-transform: none;
		letter-spacing: 0;
		font-size: 0.74rem;
		color: #f1f5f9;
	}
	input,
	select {
		background: rgba(5, 10, 20, 0.7);
		border: 1px solid rgba(0, 165, 207, 0.22);
		color: #f1f5f9;
		padding: 0.3rem 0.45rem;
		font-size: 0.8rem;
		width: 100%;
	}
	input[type='checkbox'] {
		width: auto;
		cursor: pointer;
	}
	input:focus,
	select:focus {
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

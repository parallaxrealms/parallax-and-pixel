<script lang="ts">
	// Single-node inspector — lives in the viewer's right panel when a graph node
	// is selected in the studio. Mutates the shared $state scene live (autosaved).
	import { Trash2 } from 'lucide-svelte';
	import type { SceneDoc } from './schema';
	import { allScenes } from './library';

	let { scene, id, onDelete }: { scene: SceneDoc; id: string; onDelete: () => void } = $props();

	let node = $derived(scene.data.nodes?.find((n) => n.id === id));
	let linkTargets = $derived(allScenes().filter((s) => s.id !== scene.id));

	function setLinkScene(sceneId: string) {
		if (!node) return;
		if (!sceneId) node.link = undefined;
		else node.link = { sceneId, label: node.link?.label };
	}
	function setLinkLabel(label: string) {
		if (!node?.link) return;
		node.link.label = label || undefined;
	}

	function del() {
		scene.data.nodes = (scene.data.nodes ?? []).filter((n) => n.id !== id);
		scene.data.edges = (scene.data.edges ?? []).filter((e) => e.source !== id && e.target !== id);
		onDelete();
	}
</script>

{#if node}
	<div class="insp">
		<label class="f">
			<span>Label</span>
			<input bind:value={node.label} placeholder="Node label" />
		</label>
		<div class="row2">
			<label class="f color-f">
				<span>Color</span>
				<input
					type="color"
					value={node.color ?? '#4d7cff'}
					oninput={(e) => (node.color = e.currentTarget.value)}
				/>
			</label>
			<label class="f grow">
				<span>Group</span>
				<input
					value={node.group ?? ''}
					oninput={(e) => (node.group = e.currentTarget.value)}
					placeholder="optional"
				/>
			</label>
		</div>
		<label class="f">
			<span>Detail panel (markdown)</span>
			<textarea
				value={node.panel ?? ''}
				oninput={(e) => (node.panel = e.currentTarget.value)}
				rows="8"
				placeholder="What this node is…"
			></textarea>
		</label>
		<div class="drill">
			<span class="ls-head">Drill-down link</span>
			<label class="f">
				<span>Target scene</span>
				<select
					value={node.link?.sceneId ?? ''}
					onchange={(e) => setLinkScene(e.currentTarget.value)}
				>
					<option value="">— none —</option>
					{#each linkTargets as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</label>
			<label class="f">
				<span>Link label</span>
				<input
					value={node.link?.label ?? ''}
					oninput={(e) => setLinkLabel(e.currentTarget.value)}
					disabled={!node.link}
					placeholder="Drill CTA (optional)"
				/>
			</label>
		</div>

		<button class="del" onclick={del}><Trash2 size={13} strokeWidth={2} /> Delete node</button>
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
	input,
	textarea,
	select {
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
	input:focus,
	textarea:focus,
	select:focus {
		outline: none;
		border-color: var(--accent-primary, #00a5cf);
	}
	input:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	textarea {
		resize: vertical;
		font-family: ui-monospace, monospace;
		font-size: 0.74rem;
		line-height: 1.45;
	}
	.drill {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.5rem;
		border: 1px dashed rgba(0, 165, 207, 0.25);
	}
	.ls-head {
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #93a4c4;
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

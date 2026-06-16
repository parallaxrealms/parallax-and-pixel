<script lang="ts">
	// Single-layer inspector — lives in the viewer's right panel when a stack layer
	// is selected in the studio. Mutates the shared $state scene live (autosaved).
	import { Trash2, ChevronUp, ChevronDown } from 'lucide-svelte';
	import type { SceneDoc, VizLayer, LabelShow, LabelAnchor } from './schema';
	import { allScenes } from './library';

	let { scene, id, onDelete }: { scene: SceneDoc; id: string; onDelete: () => void } = $props();

	let layers = $derived(scene.data.layers ?? []);
	let index = $derived(layers.findIndex((l) => l.id === id));
	let layer = $derived(layers[index]);
	let linkTargets = $derived(allScenes().filter((s) => s.id !== scene.id));

	function setLinkScene(sceneId: string) {
		if (!layer) return;
		if (!sceneId) layer.link = undefined;
		else layer.link = { sceneId, label: layer.link?.label };
	}
	function setLinkLabel(label: string) {
		if (!layer?.link) return;
		layer.link.label = label || undefined;
	}

	const SHOW_OPTS: LabelShow[] = ['always', 'hover', 'hidden'];
	const ANCHORS: LabelAnchor[] = ['band', 'left', 'right', 'above'];

	function lstyle(l: VizLayer) {
		if (!l.labelStyle) l.labelStyle = {};
		return l.labelStyle;
	}
	function move(dir: -1 | 1) {
		const a = [...layers];
		const j = index + dir;
		if (j < 0 || j >= a.length) return;
		[a[index], a[j]] = [a[j], a[index]];
		scene.data.layers = a;
	}
	function del() {
		scene.data.layers = layers.filter((l) => l.id !== id);
		onDelete();
	}
</script>

{#if layer}
	<div class="insp">
		<div class="reorder">
			<button onclick={() => move(-1)} disabled={index === 0} aria-label="Move up">
				<ChevronUp size={14} strokeWidth={2} />
			</button>
			<span>Layer {index + 1} of {layers.length}</span>
			<button onclick={() => move(1)} disabled={index === layers.length - 1} aria-label="Move down">
				<ChevronDown size={14} strokeWidth={2} />
			</button>
		</div>

		<label class="f"><span>Label</span><input bind:value={layer.label} placeholder="Layer label" /></label>
		<div class="row2">
			<label class="f color-f">
				<span>Color</span>
				<input
					type="color"
					value={layer.color}
					oninput={(e) => (layer.color = e.currentTarget.value)}
				/>
			</label>
			<label class="f grow">
				<span>Sublabel</span>
				<input
					value={layer.sublabel ?? ''}
					oninput={(e) => (layer.sublabel = e.currentTarget.value)}
					placeholder="optional"
				/>
			</label>
		</div>
		<label class="f">
			<span>Detail panel (markdown)</span>
			<textarea
				value={layer.panel ?? ''}
				oninput={(e) => (layer.panel = e.currentTarget.value)}
				rows="7"
				placeholder="What this layer is…"
			></textarea>
		</label>

		<div class="label-style">
			<span class="ls-head">Label display</span>
			<div class="ls-row">
				<span class="ls-label">Show</span>
				<div class="seg">
					{#each SHOW_OPTS as opt}
						<button
							class:active={(layer.labelStyle?.show ?? 'always') === opt}
							onclick={() => (lstyle(layer).show = opt)}>{opt}</button
						>
					{/each}
				</div>
			</div>
			<div class="ls-row">
				<span class="ls-label">Scale</span>
				<input
					type="range"
					min="0.5"
					max="2"
					step="0.1"
					value={layer.labelStyle?.scale ?? 1}
					oninput={(e) => (lstyle(layer).scale = Number(e.currentTarget.value))}
				/>
				<span class="ls-val">{(layer.labelStyle?.scale ?? 1).toFixed(1)}×</span>
			</div>
			<div class="ls-row">
				<span class="ls-label">Offset</span>
				<input
					class="num"
					type="number"
					value={layer.labelStyle?.offsetX ?? 0}
					oninput={(e) => (lstyle(layer).offsetX = Number(e.currentTarget.value))}
					aria-label="Offset X"
				/>
				<input
					class="num"
					type="number"
					value={layer.labelStyle?.offsetY ?? 0}
					oninput={(e) => (lstyle(layer).offsetY = Number(e.currentTarget.value))}
					aria-label="Offset Y"
				/>
			</div>
			<div class="ls-row">
				<span class="ls-label">Anchor</span>
				<div class="seg">
					{#each ANCHORS as a}
						<button
							class:active={(layer.labelStyle?.anchor ?? 'band') === a}
							onclick={() => (lstyle(layer).anchor = a)}>{a}</button
						>
					{/each}
				</div>
			</div>
		</div>

		<div class="drill">
			<span class="ls-head">Drill-down link</span>
			<label class="f">
				<span>Target scene</span>
				<select
					value={layer.link?.sceneId ?? ''}
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
					value={layer.link?.label ?? ''}
					oninput={(e) => setLinkLabel(e.currentTarget.value)}
					disabled={!layer.link}
					placeholder="Drill CTA (optional)"
				/>
			</label>
		</div>

		<button class="del" onclick={del}><Trash2 size={13} strokeWidth={2} /> Delete layer</button>
	</div>
{/if}

<style>
	.insp {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		font-size: 0.8rem;
	}
	.reorder {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.66rem;
		color: #93a4c4;
	}
	.reorder button {
		display: grid;
		place-items: center;
		width: 26px;
		height: 24px;
		color: #93a4c4;
		background: rgba(5, 10, 20, 0.6);
		border: 1px solid rgba(0, 165, 207, 0.18);
		cursor: pointer;
	}
	.reorder button:hover:not(:disabled) {
		color: #fff;
	}
	.reorder button:disabled {
		opacity: 0.35;
		cursor: default;
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
	.label-style {
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
	.ls-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.ls-label {
		width: 3.2rem;
		flex: none;
		font-size: 0.64rem;
		text-transform: uppercase;
		color: #93a4c4;
	}
	.seg {
		display: flex;
		gap: 0.2rem;
		flex: 1;
	}
	.seg button {
		flex: 1;
		padding: 0.15rem 0.3rem;
		font-size: 0.62rem;
		text-transform: capitalize;
		color: #93a4c4;
		background: rgba(5, 10, 20, 0.6);
		border: 1px solid rgba(0, 165, 207, 0.18);
		cursor: pointer;
	}
	.seg button.active {
		color: #fff;
		background: var(--accent-primary, #00a5cf);
		border-color: var(--accent-primary, #00a5cf);
	}
	.ls-row input[type='range'] {
		flex: 1;
		padding: 0;
		border: none;
		background: transparent;
	}
	.num {
		width: 3.2rem;
		flex: none;
	}
	.ls-val {
		width: 2.4rem;
		flex: none;
		font-size: 0.66rem;
		color: #93a4c4;
		text-align: right;
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

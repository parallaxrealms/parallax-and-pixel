<script lang="ts">
	// Single-series inspector (Line / Area / Scatter). Edits the shared $state
	// scene live. Points are authored as one "x, y" pair per line.
	import { Trash2 } from 'lucide-svelte';
	import type { SceneDoc } from './schema';

	let { scene, id, onDelete }: { scene: SceneDoc; id: string; onDelete: () => void } = $props();

	let s = $derived(scene.data.series?.find((x) => x.id === id));

	// Textarea mirror of points. Local state so partial/invalid typing doesn't
	// blow away the array mid-edit; committed back on each parse.
	let pointsText = $derived(
		(s?.points ?? []).map((p) => `${p.x}, ${p.y}`).join('\n')
	);

	function commitPoints(raw: string) {
		if (!s) return;
		const parsed = raw
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => {
				const [xs, ys] = line.split(',').map((t) => t.trim());
				const xNum = Number(xs);
				const x = xs !== '' && Number.isFinite(xNum) ? xNum : xs;
				return { x, y: Number(ys) || 0 };
			});
		s.points = parsed;
	}

	function del() {
		scene.data.series = (scene.data.series ?? []).filter((x) => x.id !== id);
		onDelete();
	}
</script>

{#if s}
	<div class="insp">
		<label class="f">
			<span>Name</span>
			<input bind:value={s.name} placeholder="Series name" />
		</label>
		<div class="row2">
			<label class="f color-f">
				<span>Color</span>
				<input type="color" value={s.color ?? '#4d7cff'} oninput={(e) => (s.color = e.currentTarget.value)} />
			</label>
			<label class="f grow">
				<span>Curve</span>
				<select value={s.interpolation ?? 'linear'} onchange={(e) => (s.interpolation = e.currentTarget.value as 'linear' | 'step' | 'smooth')}>
					<option value="linear">Linear</option>
					<option value="smooth">Smooth</option>
					<option value="step">Step</option>
				</select>
			</label>
		</div>
		<label class="f">
			<span>Data points (one "x, y" per line)</span>
			<textarea
				value={pointsText}
				oninput={(e) => commitPoints(e.currentTarget.value)}
				rows="9"
				placeholder={'0, 12\n1, 18\n2, 9'}
			></textarea>
		</label>
		<button class="del" onclick={del}><Trash2 size={13} strokeWidth={2} /> Delete series</button>
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
	textarea {
		resize: vertical;
		font-family: ui-monospace, monospace;
		font-size: 0.74rem;
		line-height: 1.5;
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

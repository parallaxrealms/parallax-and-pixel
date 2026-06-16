<script lang="ts">
	// Table column inspector — edit each column's label / type / alignment / unit /
	// visibility. Mutates the shared $state scene live. Rows come from the data
	// (or a bound adapter); this pane reshapes presentation.
	import { Eye, EyeOff } from 'lucide-svelte';
	import type { SceneDoc, CellType } from './schema';

	let { scene }: { scene: SceneDoc } = $props();

	let cols = $derived(scene.data.tabular?.columns ?? []);
	const TYPES: CellType[] = ['text', 'number', 'badge', 'sparkline', 'heat', 'bar', 'link', 'date'];
	const ALIGNS = ['left', 'center', 'right'] as const;
	const hasUnit = (t?: CellType) => t === 'number' || t === 'bar' || t === 'heat';
</script>

<div class="insp">
	<p class="hint">Reshape columns. Rows come from the data source.</p>
	{#each cols as col (col.key)}
		<div class="col" class:dim={col.hidden}>
			<div class="col-head">
				<input class="lbl" bind:value={col.label} placeholder="Column label" />
				<button
					class="vis"
					title={col.hidden ? 'Show column' : 'Hide column'}
					onclick={() => (col.hidden = !col.hidden)}
					aria-label="Toggle column visibility"
				>
					{#if col.hidden}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
				</button>
			</div>
			<div class="row2">
				<label class="f">
					<span>Type</span>
					<select value={col.type ?? 'text'} onchange={(e) => (col.type = e.currentTarget.value as CellType)}>
						{#each TYPES as t}<option value={t}>{t}</option>{/each}
					</select>
				</label>
				<label class="f">
					<span>Align</span>
					<select value={col.align ?? 'left'} onchange={(e) => (col.align = e.currentTarget.value as 'left' | 'center' | 'right')}>
						{#each ALIGNS as a}<option value={a}>{a}</option>{/each}
					</select>
				</label>
				{#if hasUnit(col.type)}
					<label class="f unit">
						<span>Unit</span>
						<input value={col.unit ?? ''} oninput={(e) => (col.unit = e.currentTarget.value)} placeholder="%" />
					</label>
				{/if}
			</div>
			<div class="key">{col.key}</div>
		</div>
	{/each}
	{#if cols.length === 0}
		<p class="hint">No columns.</p>
	{/if}
</div>

<style>
	.insp {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.8rem;
	}
	.hint {
		margin: 0;
		font-size: 0.72rem;
		color: #64748b;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.5rem;
		border: 1px solid rgba(0, 165, 207, 0.18);
		background: rgba(5, 10, 20, 0.4);
	}
	.col.dim {
		opacity: 0.55;
	}
	.col-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.lbl {
		flex: 1;
		font-weight: 600;
	}
	.vis {
		display: grid;
		place-items: center;
		padding: 0.25rem;
		color: #8595b3;
		background: transparent;
		border: 1px solid rgba(0, 165, 207, 0.22);
		cursor: pointer;
		flex: none;
	}
	.vis:hover {
		color: var(--accent-primary, #00a5cf);
	}
	.row2 {
		display: flex;
		gap: 0.4rem;
	}
	.f {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
	}
	.f.unit {
		flex: 0 0 3.5rem;
	}
	.f span {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #93a4c4;
	}
	input,
	select {
		background: rgba(5, 10, 20, 0.7);
		border: 1px solid rgba(0, 165, 207, 0.22);
		color: #f1f5f9;
		padding: 0.25rem 0.4rem;
		font-size: 0.78rem;
		width: 100%;
	}
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--accent-primary, #00a5cf);
	}
	.key {
		font-size: 0.62rem;
		font-family: ui-monospace, monospace;
		color: #475569;
	}
</style>

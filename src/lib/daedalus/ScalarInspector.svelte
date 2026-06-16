<script lang="ts">
	// Scalar inspector (Stat / Gauge). Edits scene.data.scalar live, including
	// ascending threshold bands that color the value.
	import { Trash2, Plus } from 'lucide-svelte';
	import type { SceneDoc, VizScalar } from './schema';

	let { scene, primitive }: { scene: SceneDoc; primitive: 'stat' | 'gauge' } = $props();

	// Guarantee a scalar exists for editing (factory normally provides one).
	$effect(() => {
		if (!scene.data.scalar) scene.data.scalar = { value: 0 };
	});
	let s = $derived(scene.data.scalar ?? ({ value: 0 } as VizScalar));

	function setNum(key: 'value' | 'min' | 'max' | 'target' | 'delta', raw: string) {
		if (raw === '') {
			if (key === 'value') s.value = 0;
			else s[key] = undefined;
			return;
		}
		s[key] = Number(raw) || 0;
	}
	function setSpark(raw: string) {
		const nums = raw
			.split(',')
			.map((t) => Number(t.trim()))
			.filter((n) => Number.isFinite(n));
		s.spark = nums.length ? nums : undefined;
	}
	function addThreshold() {
		s.thresholds = [...(s.thresholds ?? []), { at: 0, color: '#14b8a6' }];
	}
	function delThreshold(i: number) {
		s.thresholds = (s.thresholds ?? []).filter((_, j) => j !== i);
	}
</script>

<div class="insp">
	<div class="row2">
		<label class="f grow">
			<span>Value</span>
			<input type="number" value={s.value} oninput={(e) => setNum('value', e.currentTarget.value)} />
		</label>
		<label class="f unit-f">
			<span>Unit</span>
			<input value={s.unit ?? ''} oninput={(e) => (s.unit = e.currentTarget.value)} placeholder="%" />
		</label>
	</div>
	<label class="f">
		<span>Caption</span>
		<input value={s.label ?? ''} oninput={(e) => (s.label = e.currentTarget.value)} placeholder="What this measures" />
	</label>

	{#if primitive === 'stat'}
		<label class="f">
			<span>Sparkline (comma-separated)</span>
			<input value={(s.spark ?? []).join(', ')} oninput={(e) => setSpark(e.currentTarget.value)} placeholder="12, 18, 9, 22, 15" />
		</label>
	{/if}

	{#if primitive === 'gauge'}
		<div class="row2">
			<label class="f grow">
				<span>Min</span>
				<input type="number" value={s.min ?? 0} oninput={(e) => setNum('min', e.currentTarget.value)} />
			</label>
			<label class="f grow">
				<span>Max</span>
				<input type="number" value={s.max ?? 100} oninput={(e) => setNum('max', e.currentTarget.value)} />
			</label>
		</div>
	{/if}

	<div class="row2">
		<label class="f grow">
			<span>{primitive === 'stat' ? 'Delta (trend)' : 'Target'}</span>
			{#if primitive === 'stat'}
				<input type="number" value={s.delta ?? ''} oninput={(e) => setNum('delta', e.currentTarget.value)} placeholder="vs. previous" />
			{:else}
				<input type="number" value={s.target ?? ''} oninput={(e) => setNum('target', e.currentTarget.value)} placeholder="optional" />
			{/if}
		</label>
		{#if primitive === 'stat'}
			<label class="f check-f">
				<span>Higher = good</span>
				<input
					type="checkbox"
					checked={s.higherIsBetter ?? true}
					onchange={(e) => (s.higherIsBetter = e.currentTarget.checked)}
				/>
			</label>
		{/if}
	</div>

	<div class="thresh">
		<div class="thresh-head">
			<span>Thresholds</span>
			<button class="add" onclick={addThreshold}><Plus size={12} strokeWidth={2.2} /> Band</button>
		</div>
		<p class="note">Value color switches at each band (ascending).</p>
		{#each s.thresholds ?? [] as t, i (i)}
			<div class="thresh-row">
				<input type="color" value={t.color} oninput={(e) => (t.color = e.currentTarget.value)} />
				<input type="number" value={t.at} oninput={(e) => (t.at = Number(e.currentTarget.value) || 0)} placeholder="at ≥" />
				<button class="del-sm" onclick={() => delThreshold(i)} aria-label="Remove band"><Trash2 size={12} strokeWidth={2} /></button>
			</div>
		{/each}
	</div>
</div>

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
	.grow {
		flex: 1;
	}
	.unit-f {
		width: 70px;
		flex: none;
	}
	.check-f {
		flex: none;
		align-items: center;
	}
	.check-f input {
		width: 18px;
		height: 18px;
		cursor: pointer;
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
		width: 34px;
		height: 30px;
		padding: 0;
		flex: none;
		cursor: pointer;
	}
	input:focus {
		outline: none;
		border-color: var(--accent-primary, #00a5cf);
	}
	.thresh {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.2rem;
		padding-top: 0.6rem;
		border-top: 1px solid rgba(0, 165, 207, 0.18);
	}
	.thresh-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.thresh-head span {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #93a4c4;
	}
	.note {
		margin: 0;
		font-size: 0.68rem;
		color: #64748b;
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.45rem;
		font-size: 0.68rem;
		color: var(--accent-primary, #00a5cf);
		background: rgba(77, 124, 255, 0.1);
		border: 1px solid rgba(0, 165, 207, 0.3);
		cursor: pointer;
	}
	.thresh-row {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.del-sm {
		display: grid;
		place-items: center;
		padding: 0.3rem;
		color: #f87171;
		background: transparent;
		border: 1px solid rgba(248, 113, 113, 0.25);
		cursor: pointer;
		flex: none;
	}
	.del-sm:hover {
		background: rgba(248, 113, 113, 0.16);
	}
</style>

<script lang="ts">
	// Scene-level 3D environment settings (Stack primitive): lighting, material,
	// camera, controls. Mutates scene.style.environment in place (autosaved).
	// Sliders commit on release (onchange) so the canvas remounts once per change
	// rather than on every drag tick.
	import type { SceneDoc, SceneEnvironment } from './schema';

	let { scene }: { scene: SceneDoc } = $props();

	let e = $derived<SceneEnvironment>(scene.style?.environment ?? {});
	let isSeries = $derived(
		scene.primitive === 'line' || scene.primitive === 'area' || scene.primitive === 'scatter'
	);
	let isTable = $derived(scene.primitive === 'table');

	function style() {
		if (!scene.style) scene.style = {};
		return scene.style;
	}
	function tableStyle() {
		const s = style();
		if (!s.table) s.table = {};
		return s.table;
	}
	function env(): SceneEnvironment {
		if (!scene.style) scene.style = {};
		if (!scene.style.environment) scene.style.environment = {};
		return scene.style.environment;
	}
	function setNum(
		key: 'ambientIntensity' | 'keyIntensity' | 'metalness' | 'roughness' | 'cameraFov' | 'damping',
		v: number
	) {
		env()[key] = v;
	}
</script>

<div class="ss">
	{#if isSeries}
		<h4>Chart options</h4>
		{#if scene.primitive !== 'scatter'}
			<label class="chk">
				<input
					type="checkbox"
					checked={scene.style?.stacked ?? false}
					onchange={(ev) => (style().stacked = ev.currentTarget.checked)}
				/>
				Stacked
			</label>
			<label class="chk">
				<input
					type="checkbox"
					checked={scene.style?.showDots ?? false}
					onchange={(ev) => (style().showDots = ev.currentTarget.checked)}
				/>
				Show points
			</label>
			<p class="note">Per-series curve style (linear / smooth / step) is set in each series' inspector.</p>
		{:else}
			<p class="note">Scatter plots have no extra options yet — edit point data per series.</p>
		{/if}
	{:else if isTable}
		<h4>Table options</h4>
		<div class="r">
			<span>Density</span>
			<select class="sel" value={scene.style?.table?.density ?? 'comfortable'} onchange={(ev) => (tableStyle().density = ev.currentTarget.value as 'compact' | 'comfortable')}>
				<option value="comfortable">Comfortable</option>
				<option value="compact">Compact</option>
			</select>
		</div>
		<div class="r">
			<span>Mobile</span>
			<select class="sel" value={scene.style?.table?.mobileLayout ?? 'cards'} onchange={(ev) => (tableStyle().mobileLayout = ev.currentTarget.value as 'cards' | 'scroll')}>
				<option value="cards">Stacked cards</option>
				<option value="scroll">Horizontal scroll</option>
			</select>
		</div>
		<label class="chk">
			<input type="checkbox" checked={scene.style?.table?.striped ?? true} onchange={(ev) => (tableStyle().striped = ev.currentTarget.checked)} />
			Striped rows
		</label>
		<p class="note">Edit columns (type, alignment, visibility) from the column inspector.</p>
	{:else}
		<h4>View</h4>
		<label class="chk">
			<input
				type="checkbox"
				checked={e.wireframe ?? false}
				onchange={(ev) => (env().wireframe = ev.currentTarget.checked)}
			/>
			Wireframe
		</label>
		<label class="chk">
			<input
				type="checkbox"
				checked={e.showGrid ?? true}
				onchange={(ev) => (env().showGrid = ev.currentTarget.checked)}
			/>
			Show grid
		</label>

		<h4>Camera</h4>
	<div class="r">
		<span>FOV</span>
		<input
			type="range"
			min="25"
			max="80"
			step="1"
			value={e.cameraFov ?? 42}
			onchange={(ev) => setNum('cameraFov', Number(ev.currentTarget.value))}
		/>
		<span class="v">{e.cameraFov ?? 42}°</span>
	</div>
	<div class="r">
		<span>Damping</span>
		<input
			type="range"
			min="0.02"
			max="0.3"
			step="0.01"
			value={e.damping ?? 0.1}
			onchange={(ev) => setNum('damping', Number(ev.currentTarget.value))}
		/>
		<span class="v">{(e.damping ?? 0.1).toFixed(2)}</span>
	</div>
	<label class="chk">
		<input
			type="checkbox"
			checked={e.autoRotate ?? false}
			onchange={(ev) => (env().autoRotate = ev.currentTarget.checked)}
		/>
		Auto-rotate
	</label>

	<h4>Lighting</h4>
	<div class="r">
		<span>Ambient</span>
		<input
			type="range"
			min="0"
			max="2"
			step="0.05"
			value={e.ambientIntensity ?? 0.7}
			onchange={(ev) => setNum('ambientIntensity', Number(ev.currentTarget.value))}
		/>
		<span class="v">{(e.ambientIntensity ?? 0.7).toFixed(2)}</span>
	</div>
	<div class="r">
		<span>Key light</span>
		<input
			type="range"
			min="0"
			max="3"
			step="0.05"
			value={e.keyIntensity ?? 1.05}
			onchange={(ev) => setNum('keyIntensity', Number(ev.currentTarget.value))}
		/>
		<span class="v">{(e.keyIntensity ?? 1.05).toFixed(2)}</span>
	</div>

	<h4>Material</h4>
	<div class="r">
		<span>Metalness</span>
		<input
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={e.metalness ?? 0.12}
			onchange={(ev) => setNum('metalness', Number(ev.currentTarget.value))}
		/>
		<span class="v">{(e.metalness ?? 0.12).toFixed(2)}</span>
	</div>
	<div class="r">
		<span>Roughness</span>
		<input
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={e.roughness ?? 0.5}
			onchange={(ev) => setNum('roughness', Number(ev.currentTarget.value))}
		/>
		<span class="v">{(e.roughness ?? 0.5).toFixed(2)}</span>
	</div>

		<p class="note">Changes apply when you release the slider.</p>
	{/if}
</div>

<style>
	.ss {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.8rem;
	}
	h4 {
		margin: 0.5rem 0 0;
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--accent-primary, #00a5cf);
	}
	h4:first-child {
		margin-top: 0;
	}
	.r {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.r > span:first-child {
		width: 5rem;
		flex: none;
		font-size: 0.72rem;
		color: #94a3b8; /* slate-400 */
	}
	.r input[type='range'] {
		flex: 1;
		accent-color: var(--accent-primary, #00a5cf);
	}
	.r select.sel {
		flex: 1;
		background: #0f172a; /* slate-900 */
		border: 1px solid #334155; /* slate-700 */
		color: #e2e8f0; /* slate-200 */
		padding: 0.25rem 0.35rem;
		font-size: 0.74rem;
	}
	.r select.sel:focus {
		outline: none;
		border-color: var(--accent-primary, #00a5cf);
	}
	.v {
		width: 2.6rem;
		flex: none;
		text-align: right;
		font-size: 0.7rem;
		color: #cbd5e1;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.74rem;
		color: #cbd5e1; /* slate-300 */
		cursor: pointer;
	}
	.chk input[type='checkbox'] {
		accent-color: var(--accent-primary, #00a5cf);
	}
	.note {
		margin: 0.4rem 0 0;
		font-size: 0.68rem;
		color: #64748b;
	}
</style>

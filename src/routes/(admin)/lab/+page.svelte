<script lang="ts">
	/**
	 * /lab — Scene Lab.
	 *
	 * Admin-gated tuning UI for the ModelScene three.js engine. Holds ONE
	 * deeply-reactive SceneConfig in $state; every knob binds straight into
	 * it and <ModelScene {config}> live-applies changes itself (the engine
	 * watches the config via its own $effect — no per-knob plumbing here).
	 *
	 * "Copy as code" dumps the current config as a paste-ready snippet for
	 * src/lib/three/heroConfig.ts. Presets live in localStorage under
	 * 'pxp-lab:presets' with a factory seed on first visit.
	 */
	import { onMount, tick } from 'svelte';
	import ModelScene from '$lib/three/ModelScene.svelte';
	import {
		DEFAULT_SCENE_CONFIG,
		cloneConfig,
		normalizeConfig,
		type SceneConfig,
		type DirectionalLightConfig,
		type PrimitiveShape
	} from '$lib/three/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ─── The single source of truth ────────────────────────────────────────
	// normalizeConfig guarantees model.shape + the overlay block exist, so
	// every new knob can bind without optional-chaining gymnastics.
	let config = $state<SceneConfig>(normalizeConfig(DEFAULT_SCENE_CONFIG));

	// Safe alias for the overlay knobs — always present after normalizeConfig.
	let overlay = $derived(config.overlay!);

	// Safe alias for the wireframe shell knobs — same normalizeConfig invariant.
	let shell = $derived(config.model.wireframeShell!);

	// ─── Loading overlay ────────────────────────────────────────────────────
	// Shown until the engine fires onReady (which also fires on load failure).
	// A 12s fallback guards against the callback never arriving.
	let sceneLoading = $state(true);

	// ─── Panel collapse (button + H key) ────────────────────────────────────
	let panelOpen = $state(true);

	// H hides ALL fixed chrome (right panel + top-left jump nav, including
	// their toggle buttons). Un-hiding restores the panel open; the jump
	// nav's own collapsed/expanded state (navOpen) is preserved.
	let chromeHidden = $state(false);

	function onKeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;

		// Undo / redo — Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (metaKey too). Allowed
		// while focus sits on range/checkbox/color inputs; skipped only in
		// text-entry contexts so native field undo keeps working.
		if (
			(e.ctrlKey || e.metaKey) &&
			(e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')
		) {
			if (isTextEntryTarget(t)) return;
			e.preventDefault();
			if (e.key === 'y' || e.key === 'Y' || e.shiftKey) {
				redo();
			} else {
				undo();
			}
			return;
		}

		if (e.key !== 'h' && e.key !== 'H') return;
		if (t) {
			const tag = t.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
				return;
			}
		}
		if (chromeHidden) {
			chromeHidden = false;
			panelOpen = true;
		} else {
			chromeHidden = true;
		}
	}

	// ─── Accordion sections + jump navigation ───────────────────────────────
	const SECTIONS = [
		{ key: 'model', label: 'Model' },
		{ key: 'lights', label: 'Lights' },
		{ key: 'material', label: 'Material' },
		{ key: 'fresnel', label: 'Fresnel rim' },
		{ key: 'post', label: 'Post-processing' },
		{ key: 'overlay', label: 'Overlay Settings' },
		{ key: 'camera', label: 'Camera' },
		{ key: 'renderer', label: 'Renderer' },
		{ key: 'presets', label: 'Presets' }
	] as const;

	// All sections open on load; nothing persisted.
	let open = $state<Record<string, boolean>>(
		Object.fromEntries(SECTIONS.map((s) => [s.key, true]))
	);

	let navOpen = $state(false);

	async function jumpTo(key: string) {
		panelOpen = true;
		open[key] = true;
		await tick(); // panel/section may need to (re)render first
		document
			.getElementById(`sec-${key}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// ─── Model source (shapes / static models / custom path) ────────────────
	const SHAPES: { value: PrimitiveShape; label: string }[] = [
		{ value: 'icosahedron', label: 'Icosahedron' },
		{ value: 'cube', label: 'Cube' },
		{ value: 'sphere', label: 'Sphere' },
		{ value: 'torus', label: 'Torus' },
		{ value: 'torusKnot', label: 'Torus Knot' },
		{ value: 'cone', label: 'Cone' }
	];

	const CUSTOM_OPTION = '__custom__';

	let customPath = $state('');
	// True while the user has explicitly picked "custom model…" (even before
	// applying a path). A loaded path not present in data.models also counts.
	let customMode = $state(false);

	let isCustomPath = $derived(
		config.model.path !== null && !data.models.includes(config.model.path)
	);
	let showCustomInput = $derived(customMode || isCustomPath);

	let modelSelectValue = $derived(
		customMode || isCustomPath
			? CUSTOM_OPTION
			: config.model.path === null
				? `shape:${config.model.shape ?? 'icosahedron'}`
				: config.model.path
	);

	function onModelSelect(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		if (v === CUSTOM_OPTION) {
			customMode = true;
			customPath = config.model.path ?? '';
			return;
		}
		customMode = false;
		if (v.startsWith('shape:')) {
			config.model.path = null;
			config.model.shape = v.slice('shape:'.length) as PrimitiveShape;
		} else {
			config.model.path = v;
		}
	}

	function applyCustomPath() {
		const trimmed = customPath.trim();
		config.model.path = trimmed === '' ? null : trimmed;
	}

	// ─── Presets (localStorage) ──────────────────────────────────────────────
	const PRESET_KEY = 'pxp-lab:presets';

	let presets = $state<Record<string, SceneConfig>>({});
	let presetName = $state('');
	let saveFlash = $state(false);

	let presetNames = $derived(Object.keys(presets).sort());

	function loadPresetsFromStorage() {
		try {
			const raw = window.localStorage.getItem(PRESET_KEY);
			if (raw) {
				// Normalize every stored preset so configs saved before
				// model.shape / overlay existed don't crash the new knobs.
				const parsed = JSON.parse(raw) as Record<string, unknown>;
				const next: Record<string, SceneConfig> = {};
				for (const [name, cfg] of Object.entries(parsed)) {
					next[name] = normalizeConfig(cfg);
				}
				presets = next;
			} else {
				// First visit only: seed a factory preset so the list is never
				// empty. Never re-injected — deleting it sticks.
				presets = { 'P&P Default': normalizeConfig(DEFAULT_SCENE_CONFIG) };
				writePresetsToStorage();
			}
		} catch (e) {
			console.warn('[lab] could not load presets', e);
		}
	}

	function writePresetsToStorage() {
		try {
			window.localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
		} catch (e) {
			console.warn('[lab] could not save presets', e);
		}
	}

	function savePreset() {
		const name = presetName.trim();
		if (!name) return;
		// Clone on save so later knob edits never mutate the stored preset.
		presets = { ...presets, [name]: cloneConfig(config) };
		writePresetsToStorage();
		saveFlash = true;
		setTimeout(() => (saveFlash = false), 1200);
	}

	function loadPreset(name: string) {
		const p = presets[name];
		if (!p) return;
		// normalizeConfig deep-clones, so knob edits never mutate the stored
		// preset — and legacy presets gain shape/overlay defaults.
		config = normalizeConfig(p);
		customMode = false;
		customPath = config.model.path ?? '';
		presetName = name;
	}

	function deletePreset(name: string) {
		if (!confirm(`Delete preset "${name}"?`)) return;
		const { [name]: _drop, ...rest } = presets;
		void _drop;
		presets = rest;
		writePresetsToStorage();
	}

	// ─── Copy as code ────────────────────────────────────────────────────────
	let copied = $state(false);

	function buildSnippet(): string {
		const json = JSON.stringify(cloneConfig(config), null, '\t');
		return `// Generated by /lab — paste into src/lib/three/heroConfig.ts\nexport const HERO_SCENE_CONFIG: SceneConfig = ${json};\n`;
	}

	async function copyAsCode() {
		try {
			await navigator.clipboard.writeText(buildSnippet());
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch (e) {
			console.warn('[lab] clipboard write failed', e);
		}
	}

	// ─── Reset ───────────────────────────────────────────────────────────────
	function resetAll() {
		config = normalizeConfig(DEFAULT_SCENE_CONFIG);
		customMode = false;
		customPath = config.model.path ?? '';
	}

	// ─── Undo / redo history ─────────────────────────────────────────────────
	// Snapshot stack of serialized configs + pointer. A $effect watches
	// JSON.stringify(config) (which tracks every nested knob) and DEBOUNCES
	// the push so one slider drag lands as ONE entry, not 50. There is no
	// guard flag: applying a snapshot sets config exactly equal to
	// history[historyIndex], so the "differs from the current entry" check
	// makes the capture effect a no-op by construction (data-driven guard).
	const HISTORY_MAX = 100;
	const HISTORY_DEBOUNCE_MS = 400;

	// Seeded with the initial config so the very first edit is undoable
	// back to the starting state. Capturing the INITIAL value is the point
	// here — later config changes flow in via the capture $effect below.
	// svelte-ignore state_referenced_locally
	let history = $state<string[]>([JSON.stringify(config)]);
	let historyIndex = $state(0);
	let historyTimer: ReturnType<typeof setTimeout> | null = null;

	let canUndo = $derived(historyIndex > 0);
	let canRedo = $derived(historyIndex < history.length - 1);

	$effect(() => {
		const snapshot = JSON.stringify(config);
		if (snapshot === history[historyIndex]) return;
		if (historyTimer !== null) clearTimeout(historyTimer);
		historyTimer = setTimeout(() => {
			historyTimer = null;
			commitHistory(snapshot);
		}, HISTORY_DEBOUNCE_MS);
	});

	function commitHistory(snapshot: string) {
		if (snapshot === history[historyIndex]) return;
		// Pushing while mid-stack truncates the redo tail (standard behavior).
		const next = history.slice(0, historyIndex + 1);
		next.push(snapshot);
		if (next.length > HISTORY_MAX) next.splice(0, next.length - HISTORY_MAX);
		history = next;
		historyIndex = next.length - 1;
	}

	// Commit any pending debounced edit NOW so a late timer can never fire
	// after undo/redo and corrupt the stack — and so undo steps back to the
	// state immediately before the in-flight edit.
	function flushPendingHistory() {
		if (historyTimer === null) return;
		clearTimeout(historyTimer);
		historyTimer = null;
		commitHistory(JSON.stringify(config));
	}

	function applyHistoryEntry(index: number) {
		const snapshot = history[index];
		if (snapshot === undefined) return;
		historyIndex = index;
		// normalizeConfig keeps the lab's invariant (shape / overlay / shell
		// always present) and deep-clones, so knob edits never mutate the
		// stack entry. Sync customPath the same way loadPreset does.
		config = normalizeConfig(JSON.parse(snapshot));
		customMode = false;
		customPath = config.model.path ?? '';
	}

	function undo() {
		flushPendingHistory();
		if (historyIndex > 0) applyHistoryEntry(historyIndex - 1);
	}

	function redo() {
		flushPendingHistory(); // an uncommitted edit kills the redo tail
		if (historyIndex < history.length - 1) applyHistoryEntry(historyIndex + 1);
	}

	// Text-entry contexts keep their native undo; range/checkbox/color
	// inputs are fine to intercept for scene undo/redo.
	function isTextEntryTarget(t: HTMLElement | null): boolean {
		if (!t) return false;
		if (t.isContentEditable) return true;
		const tag = t.tagName;
		if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
		if (tag === 'INPUT') {
			const type = (t as HTMLInputElement).type;
			return type !== 'range' && type !== 'checkbox' && type !== 'color';
		}
		return false;
	}

	onMount(() => {
		loadPresetsFromStorage();
		const loadFallback = setTimeout(() => (sceneLoading = false), 12000);
		return () => {
			clearTimeout(loadFallback);
			if (historyTimer !== null) clearTimeout(historyTimer);
		};
	});
</script>

<svelte:head>
	<title>Scene Lab // Parallax&amp;Pixel</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<!-- Full-screen scene background. The engine live-applies config changes. -->
<div class="scene-bg" aria-hidden="true">
	<ModelScene {config} onReady={() => (sceneLoading = false)} />
</div>

{#if sceneLoading}
	<div class="scene-loading">
		<p class="scene-loading-text font-terminal">
			loading scene...<span class="cursor" aria-hidden="true">█</span>
		</p>
	</div>
{/if}

<!-- ── Section jump navigation (top-left) ── -->
<!-- chromeHidden (H key) removes ALL fixed chrome, toggle buttons included. -->
{#if !chromeHidden}
<nav class="jump-nav" aria-label="Section navigation">
	<button
		type="button"
		class="jump-toggle font-terminal"
		onclick={() => (navOpen = !navOpen)}
		aria-label={navOpen ? 'Hide section navigation' : 'Show section navigation'}
	>
		☰
	</button>
	{#if navOpen}
		<div class="jump-list">
			{#each SECTIONS as s (s.key)}
				<button type="button" class="jump-item" onclick={() => jumpTo(s.key)}>
					{s.label}
				</button>
			{/each}
		</div>
	{/if}
</nav>

<button
	type="button"
	class="panel-toggle font-terminal"
	onclick={() => (panelOpen = !panelOpen)}
	aria-label={panelOpen ? 'Hide panel' : 'Show panel'}
>
	{panelOpen ? '→' : '←'}
</button>
{/if}

{#if !chromeHidden && panelOpen}
	<aside class="lab-panel" aria-label="Scene Lab controls">
		<header class="panel-head">
			<h1 class="title font-display">Scene Lab</h1>
			<div class="hist-controls">
				<button
					type="button"
					class="hist-btn font-terminal"
					onclick={undo}
					disabled={!canUndo}
					title="Undo (Ctrl+Z)"
					aria-label="Undo (Ctrl+Z)">↩</button
				>
				<span class="hist-counter">{historyIndex + 1}/{history.length}</span>
				<button
					type="button"
					class="hist-btn font-terminal"
					onclick={redo}
					disabled={!canRedo}
					title="Redo (Ctrl+Shift+Z)"
					aria-label="Redo (Ctrl+Shift+Z)">↪</button
				>
			</div>
			<div class="hint font-terminal">press <kbd>H</kbd> to hide</div>
		</header>

		{#snippet secHead(label: string, key: string)}
			<summary class="sec-head font-terminal">
				<span class="caret" aria-hidden="true">{open[key] ? '▾' : '▸'}</span>
				{label}
			</summary>
		{/snippet}

		<!-- ── Model ── -->
		<details class="group" id="sec-model" bind:open={open.model}>
			{@render secHead('Model', 'model')}
			<label class="row">
				<span>source</span>
				<select class="select" value={modelSelectValue} onchange={onModelSelect}>
					<optgroup label="shapes">
						{#each SHAPES as shape (shape.value)}
							<option value={`shape:${shape.value}`}>{shape.label}</option>
						{/each}
					</optgroup>
					<optgroup label="static/models">
						{#each data.models as model (model)}
							<option value={model}>{model}</option>
						{/each}
					</optgroup>
					<option value={CUSTOM_OPTION}>custom model…</option>
				</select>
				<output></output>
			</label>
			{#if showCustomInput}
				<div class="row" style="grid-template-columns: 1fr auto;">
					<input
						type="text"
						class="text-input"
						bind:value={customPath}
						placeholder="/models/your-model.glb"
						onkeydown={(e) => e.key === 'Enter' && applyCustomPath()}
					/>
					<button type="button" class="btn-ghost btn-small" onclick={applyCustomPath}>Load</button>
				</div>
				<p class="hint-row">paths resolve under /static — press Enter or Load to apply</p>
			{/if}
			<p class="hint-row">drop .glb/.gltf/.obj/.fbx files into static/models/ and reload</p>

			<label class="row toggle">
				<input type="checkbox" bind:checked={shell.on} />
				<span class="label">duplicate model to wireframe</span>
			</label>
			{#if shell.on}
				<div class="sub">
					<label class="row">
						<span>color</span>
						<input
							type="color"
							value={shell.color}
							oninput={(e) => (shell.color = e.currentTarget.value)}
						/>
						<code>{shell.color}</code>
					</label>
					<label class="row">
						<span>opacity</span>
						<input type="range" min="0" max="1" step="0.01" bind:value={shell.opacity} />
						<output>{shell.opacity.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>scale</span>
						<input type="range" min="0.5" max="3" step="0.01" bind:value={shell.scale} />
						<output>{shell.scale.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>x</span>
						<input type="range" min="-3" max="3" step="0.01" bind:value={shell.x} />
						<output>{shell.x.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>y</span>
						<input type="range" min="-3" max="3" step="0.01" bind:value={shell.y} />
						<output>{shell.y.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>z</span>
						<input type="range" min="-3" max="3" step="0.01" bind:value={shell.z} />
						<output>{shell.z.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>rot x</span>
						<input type="range" min="-3.14" max="3.14" step="0.01" bind:value={shell.rotationX} />
						<output>{shell.rotationX.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>rot y</span>
						<input type="range" min="-3.14" max="3.14" step="0.01" bind:value={shell.rotationY} />
						<output>{shell.rotationY.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>rot z</span>
						<input type="range" min="-3.14" max="3.14" step="0.01" bind:value={shell.rotationZ} />
						<output>{shell.rotationZ.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>spin speed</span>
						<input type="range" min="-2" max="2" step="0.01" bind:value={shell.spinSpeed} />
						<output>{shell.spinSpeed.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>float amp</span>
						<input type="range" min="0" max="1" step="0.01" bind:value={shell.floatAmplitude} />
						<output>{shell.floatAmplitude.toFixed(2)}</output>
					</label>
					<label class="row">
						<span>float speed</span>
						<input type="range" min="0" max="4" step="0.01" bind:value={shell.floatSpeed} />
						<output>{shell.floatSpeed.toFixed(2)}</output>
					</label>
					<p class="hint-row">shell transform is relative to the model (1.22 = 22% larger)</p>
				</div>
			{/if}

			<label class="row">
				<span>scale</span>
				<input type="range" min="0.05" max="8" step="0.01" bind:value={config.model.scale} />
				<output>{config.model.scale.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>x</span>
				<input type="range" min="-5" max="5" step="0.05" bind:value={config.model.x} />
				<output>{config.model.x.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>y</span>
				<input type="range" min="-5" max="5" step="0.05" bind:value={config.model.y} />
				<output>{config.model.y.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>z</span>
				<input type="range" min="-5" max="5" step="0.05" bind:value={config.model.z} />
				<output>{config.model.z.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>rot x</span>
				<input type="range" min="-3.1416" max="3.1416" step="0.01" bind:value={config.model.rotationX} />
				<output>{config.model.rotationX.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>rot y</span>
				<input type="range" min="-3.1416" max="3.1416" step="0.01" bind:value={config.model.rotationY} />
				<output>{config.model.rotationY.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>rot z</span>
				<input type="range" min="-3.1416" max="3.1416" step="0.01" bind:value={config.model.rotationZ} />
				<output>{config.model.rotationZ.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>spin speed</span>
				<input type="range" min="-2" max="2" step="0.01" bind:value={config.model.spinSpeed} />
				<output>{config.model.spinSpeed.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>float amp</span>
				<input type="range" min="0" max="1" step="0.005" bind:value={config.model.floatAmplitude} />
				<output>{config.model.floatAmplitude.toFixed(3)}</output>
			</label>
			<label class="row">
				<span>float speed</span>
				<input type="range" min="0" max="4" step="0.01" bind:value={config.model.floatSpeed} />
				<output>{config.model.floatSpeed.toFixed(2)}</output>
			</label>
		</details>

		<!-- ── Lights ── -->
		{#snippet dirLight(label: string, light: DirectionalLightConfig)}
			<div class="sub">
				<label class="row toggle">
					<input type="checkbox" bind:checked={light.on} />
					<span class="label">{label}</span>
				</label>
				<label class="row">
					<span>intensity</span>
					<input type="range" min="0" max="3" step="0.01" bind:value={light.intensity} />
					<output>{light.intensity.toFixed(2)}</output>
				</label>
				<label class="row">
					<span>color</span>
					<input
						type="color"
						value={light.color}
						oninput={(e) => (light.color = e.currentTarget.value)}
					/>
					<code>{light.color}</code>
				</label>
				<label class="row">
					<span>x</span>
					<input type="range" min="-15" max="15" step="0.1" bind:value={light.x} />
					<output>{light.x.toFixed(1)}</output>
				</label>
				<label class="row">
					<span>y</span>
					<input type="range" min="-15" max="15" step="0.1" bind:value={light.y} />
					<output>{light.y.toFixed(1)}</output>
				</label>
				<label class="row">
					<span>z</span>
					<input type="range" min="-15" max="15" step="0.1" bind:value={light.z} />
					<output>{light.z.toFixed(1)}</output>
				</label>
			</div>
		{/snippet}

		<details class="group" id="sec-lights" bind:open={open.lights}>
			{@render secHead('Lights', 'lights')}
			{@render dirLight('Key', config.lights.key)}
			{@render dirLight('Rim', config.lights.rim)}
			{@render dirLight('Fill', config.lights.fill)}

			<div class="sub">
				<label class="row toggle">
					<input type="checkbox" bind:checked={config.lights.ambient.on} />
					<span class="label">Ambient</span>
				</label>
				<label class="row">
					<span>intensity</span>
					<input type="range" min="0" max="1.5" step="0.01" bind:value={config.lights.ambient.intensity} />
					<output>{config.lights.ambient.intensity.toFixed(2)}</output>
				</label>
				<label class="row">
					<span>color</span>
					<input
						type="color"
						value={config.lights.ambient.color}
						oninput={(e) => (config.lights.ambient.color = e.currentTarget.value)}
					/>
					<code>{config.lights.ambient.color}</code>
				</label>
			</div>
		</details>

		<!-- ── Material ── -->
		<details class="group" id="sec-material" bind:open={open.material}>
			{@render secHead('Material', 'material')}
			<label class="row toggle">
				<input type="checkbox" bind:checked={config.material.override} />
				<span class="label">override imported materials</span>
			</label>
			<label class="row" class:disabled={!config.material.override}>
				<span>type</span>
				<select class="select" bind:value={config.material.type} disabled={!config.material.override}>
					<option value="standard">standard (PBR)</option>
					<option value="physical">physical (PBR+)</option>
					<option value="basic">basic (unlit)</option>
					<option value="lambert">lambert</option>
					<option value="phong">phong</option>
					<option value="normal">normal (debug)</option>
					<option value="toon">toon</option>
				</select>
				<output></output>
			</label>
			<label class="row" class:disabled={!config.material.override}>
				<span>base color</span>
				<input
					type="color"
					value={config.material.baseColor}
					oninput={(e) => (config.material.baseColor = e.currentTarget.value)}
					disabled={!config.material.override}
				/>
				<code>{config.material.baseColor}</code>
			</label>
			<label class="row" class:disabled={!config.material.override}>
				<span>metalness</span>
				<input type="range" min="0" max="1" step="0.01" bind:value={config.material.metalness} disabled={!config.material.override} />
				<output>{config.material.metalness.toFixed(2)}</output>
			</label>
			<label class="row" class:disabled={!config.material.override}>
				<span>roughness</span>
				<input type="range" min="0" max="1" step="0.01" bind:value={config.material.roughness} disabled={!config.material.override} />
				<output>{config.material.roughness.toFixed(2)}</output>
			</label>
			<label class="row" class:disabled={!config.material.override}>
				<span>opacity</span>
				<input type="range" min="0" max="1" step="0.01" bind:value={config.material.opacity} disabled={!config.material.override} />
				<output>{config.material.opacity.toFixed(2)}</output>
			</label>
			<label class="row" class:disabled={!config.material.override}>
				<span>emissive</span>
				<input
					type="color"
					value={config.material.emissiveColor}
					oninput={(e) => (config.material.emissiveColor = e.currentTarget.value)}
					disabled={!config.material.override}
				/>
				<code>{config.material.emissiveColor}</code>
			</label>
			<label class="row" class:disabled={!config.material.override}>
				<span>emissive int</span>
				<input type="range" min="0" max="3" step="0.01" bind:value={config.material.emissiveIntensity} disabled={!config.material.override} />
				<output>{config.material.emissiveIntensity.toFixed(2)}</output>
			</label>
			<label class="row toggle" class:disabled={!config.material.override}>
				<input type="checkbox" bind:checked={config.material.wireframe} disabled={!config.material.override} />
				<span class="label">wireframe</span>
			</label>
			<label class="row toggle" class:disabled={!config.material.override}>
				<input type="checkbox" bind:checked={config.material.flatShading} disabled={!config.material.override} />
				<span class="label">flat shading</span>
			</label>
			<p class="hint-row">override off = the model keeps its own imported materials</p>
		</details>

		<!-- ── Fresnel ── -->
		<details class="group" id="sec-fresnel" bind:open={open.fresnel}>
			{@render secHead('Fresnel rim', 'fresnel')}
			<label class="row toggle">
				<input type="checkbox" bind:checked={config.fresnel.on} />
				<span class="label">enabled</span>
			</label>
			<label class="row toggle">
				<input type="checkbox" bind:checked={config.fresnel.drift} />
				<span class="label">auto aqua↔mint drift</span>
			</label>
			<label class="row" class:disabled={config.fresnel.drift}>
				<span>color</span>
				<input
					type="color"
					value={config.fresnel.color}
					oninput={(e) => (config.fresnel.color = e.currentTarget.value)}
					disabled={config.fresnel.drift}
				/>
				<code>{config.fresnel.color}</code>
			</label>
			<label class="row">
				<span>power</span>
				<input type="range" min="0.5" max="16" step="0.1" bind:value={config.fresnel.power} />
				<output>{config.fresnel.power.toFixed(1)}</output>
			</label>
			<label class="row" class:disabled={config.fresnel.drift}>
				<span>strength</span>
				<input type="range" min="0" max="3" step="0.01" bind:value={config.fresnel.strength} disabled={config.fresnel.drift} />
				<output>{config.fresnel.strength.toFixed(2)}</output>
			</label>
			<p class="hint-row">drift sweeps color + strength over time while on</p>
		</details>

		<!-- ── Post ── -->
		<details class="group" id="sec-post" bind:open={open.post}>
			{@render secHead('Post-processing', 'post')}

			<div class="sub">
				<label class="row toggle">
					<input type="checkbox" bind:checked={config.post.bloom.on} />
					<span class="label">Bloom</span>
				</label>
				<label class="row">
					<span>strength</span>
					<input type="range" min="0" max="3" step="0.01" bind:value={config.post.bloom.strength} />
					<output>{config.post.bloom.strength.toFixed(2)}</output>
				</label>
				<label class="row">
					<span>radius</span>
					<input type="range" min="0" max="2" step="0.01" bind:value={config.post.bloom.radius} />
					<output>{config.post.bloom.radius.toFixed(2)}</output>
				</label>
				<label class="row">
					<span>threshold</span>
					<input type="range" min="0" max="1" step="0.01" bind:value={config.post.bloom.threshold} />
					<output>{config.post.bloom.threshold.toFixed(2)}</output>
				</label>
			</div>

			<div class="sub">
				<label class="row toggle">
					<input type="checkbox" bind:checked={config.post.vignette.on} />
					<span class="label">Vignette</span>
				</label>
				<label class="row">
					<span>offset</span>
					<input type="range" min="0" max="2" step="0.01" bind:value={config.post.vignette.offset} />
					<output>{config.post.vignette.offset.toFixed(2)}</output>
				</label>
				<label class="row">
					<span>darkness</span>
					<input type="range" min="0" max="2" step="0.01" bind:value={config.post.vignette.darkness} />
					<output>{config.post.vignette.darkness.toFixed(2)}</output>
				</label>
			</div>

			<div class="sub">
				<label class="row toggle">
					<input type="checkbox" bind:checked={config.post.chromaticAberration.on} />
					<span class="label">Chromatic aberration</span>
				</label>
				<label class="row">
					<span>offset</span>
					<input type="range" min="0" max="0.01" step="0.0001" bind:value={config.post.chromaticAberration.offset} />
					<output>{config.post.chromaticAberration.offset.toFixed(4)}</output>
				</label>
			</div>

			<div class="sub">
				<label class="row toggle">
					<input type="checkbox" bind:checked={config.post.noise.on} />
					<span class="label">Noise</span>
				</label>
				<label class="row">
					<span>opacity</span>
					<input type="range" min="0" max="0.5" step="0.005" bind:value={config.post.noise.opacity} />
					<output>{config.post.noise.opacity.toFixed(3)}</output>
				</label>
			</div>
		</details>

		<!-- ── Overlay (DOM stack above the canvas) ── -->
		<details class="group" id="sec-overlay" bind:open={open.overlay}>
			{@render secHead('Overlay Settings', 'overlay')}
			<label class="row toggle">
				<input type="checkbox" bind:checked={overlay.on} />
				<span class="label">enabled</span>
			</label>
			<label class="row" class:disabled={overlay.gradient.on}>
				<span>tint</span>
				<input
					type="color"
					value={overlay.color}
					oninput={(e) => (overlay.color = e.currentTarget.value)}
					disabled={overlay.gradient.on}
				/>
				<code>{overlay.color}</code>
			</label>
			<label class="row">
				<span>opacity</span>
				<input type="range" min="0" max="1" step="0.01" bind:value={overlay.opacity} />
				<output>{overlay.opacity.toFixed(2)}</output>
			</label>

			<div class="sub">
				<label class="row toggle">
					<input type="checkbox" bind:checked={overlay.gradient.on} />
					<span class="label">Gradient</span>
				</label>
				<label class="row">
					<span>from</span>
					<input
						type="color"
						value={overlay.gradient.from}
						oninput={(e) => (overlay.gradient.from = e.currentTarget.value)}
					/>
					<code>{overlay.gradient.from}</code>
				</label>
				<label class="row">
					<span>to</span>
					<input
						type="color"
						value={overlay.gradient.to}
						oninput={(e) => (overlay.gradient.to = e.currentTarget.value)}
					/>
					<code>{overlay.gradient.to}</code>
				</label>
				<label class="row">
					<span>angle</span>
					<input type="range" min="0" max="360" step="1" bind:value={overlay.gradient.angle} />
					<output>{overlay.gradient.angle.toFixed(0)}°</output>
				</label>
				<p class="hint-row">gradient replaces the flat tint while on</p>
			</div>

			<div class="sub">
				<label class="row toggle">
					<input type="checkbox" bind:checked={overlay.vignette.on} />
					<span class="label">Vignette</span>
				</label>
				<label class="row">
					<span>strength</span>
					<input type="range" min="0" max="1" step="0.01" bind:value={overlay.vignette.strength} />
					<output>{overlay.vignette.strength.toFixed(2)}</output>
				</label>
				<label class="row">
					<span>size</span>
					<input type="range" min="0" max="100" step="1" bind:value={overlay.vignette.size} />
					<output>{overlay.vignette.size.toFixed(0)}</output>
				</label>
				<p class="hint-row">size = how far corner darkening reaches inward</p>
			</div>

			<div class="sub">
				<label class="row toggle">
					<input type="checkbox" bind:checked={overlay.scanlines.on} />
					<span class="label">Scanlines</span>
				</label>
				<label class="row">
					<span>opacity</span>
					<input type="range" min="0" max="1" step="0.01" bind:value={overlay.scanlines.opacity} />
					<output>{overlay.scanlines.opacity.toFixed(2)}</output>
				</label>
				<label class="row">
					<span>scale</span>
					<input type="range" min="2" max="16" step="1" bind:value={overlay.scanlines.scale} />
					<output>{overlay.scanlines.scale.toFixed(0)}px</output>
				</label>
			</div>
		</details>

		<!-- ── Camera ── -->
		<details class="group" id="sec-camera" bind:open={open.camera}>
			{@render secHead('Camera', 'camera')}
			<label class="row">
				<span>fov</span>
				<input type="range" min="18" max="90" step="0.5" bind:value={config.camera.fov} />
				<output>{config.camera.fov.toFixed(1)}</output>
			</label>
			<label class="row">
				<span>x</span>
				<input type="range" min="-10" max="10" step="0.05" bind:value={config.camera.x} />
				<output>{config.camera.x.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>y</span>
				<input type="range" min="-5" max="10" step="0.05" bind:value={config.camera.y} />
				<output>{config.camera.y.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>z (distance)</span>
				<input type="range" min="1" max="24" step="0.05" bind:value={config.camera.z} />
				<output>{config.camera.z.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>target y</span>
				<input type="range" min="-5" max="5" step="0.05" bind:value={config.camera.targetY} />
				<output>{config.camera.targetY.toFixed(2)}</output>
			</label>
			<label class="row toggle">
				<input type="checkbox" bind:checked={config.camera.parallax.on} />
				<span class="label">mouse parallax</span>
			</label>
			<label class="row" class:disabled={!config.camera.parallax.on}>
				<span>amount</span>
				<input type="range" min="0" max="2" step="0.01" bind:value={config.camera.parallax.amount} disabled={!config.camera.parallax.on} />
				<output>{config.camera.parallax.amount.toFixed(2)}</output>
			</label>
			<label class="row" class:disabled={!config.camera.parallax.on}>
				<span>ease</span>
				<input type="range" min="0.005" max="0.3" step="0.005" bind:value={config.camera.parallax.ease} disabled={!config.camera.parallax.on} />
				<output>{config.camera.parallax.ease.toFixed(3)}</output>
			</label>
		</details>

		<!-- ── Renderer ── -->
		<details class="group" id="sec-renderer" bind:open={open.renderer}>
			{@render secHead('Renderer', 'renderer')}
			<label class="row">
				<span>pixel ratio</span>
				<input type="range" min="0.5" max="3" step="0.05" bind:value={config.renderer.pixelRatio} />
				<output>{config.renderer.pixelRatio.toFixed(2)}</output>
			</label>
			<label class="row">
				<span>tone map</span>
				<select class="select" bind:value={config.renderer.toneMapping}>
					<option value="none">none</option>
					<option value="linear">linear</option>
					<option value="reinhard">reinhard</option>
					<option value="cineon">cineon</option>
					<option value="aces">aces filmic</option>
				</select>
				<output></output>
			</label>
			<label class="row">
				<span>exposure</span>
				<input type="range" min="0" max="3" step="0.01" bind:value={config.renderer.exposure} />
				<output>{config.renderer.exposure.toFixed(2)}</output>
			</label>
			<label class="row toggle">
				<input type="checkbox" bind:checked={config.renderer.transparent} />
				<span class="label">transparent canvas</span>
			</label>
			<label class="row" class:disabled={config.renderer.transparent}>
				<span>clear color</span>
				<input
					type="color"
					value={config.renderer.clearColor}
					oninput={(e) => (config.renderer.clearColor = e.currentTarget.value)}
					disabled={config.renderer.transparent}
				/>
				<code>{config.renderer.clearColor}</code>
			</label>
			<p class="hint-row">clear color only applies when transparent is off</p>
		</details>

		<!-- ── Presets ── -->
		<details class="group" id="sec-presets" bind:open={open.presets}>
			{@render secHead('Presets', 'presets')}
			<div class="row" style="grid-template-columns: 1fr auto;">
				<input
					type="text"
					class="text-input"
					bind:value={presetName}
					placeholder="preset name"
					onkeydown={(e) => e.key === 'Enter' && savePreset()}
				/>
				<button type="button" class="btn-ghost btn-small" onclick={savePreset}>
					{saveFlash ? '✓' : 'Save'}
				</button>
			</div>
			{#if presetNames.length === 0}
				<p class="hint-row">no presets saved yet</p>
			{:else}
				<ul class="preset-list">
					{#each presetNames as name (name)}
						<li class="preset-row">
							<button type="button" class="preset-load font-terminal" onclick={() => loadPreset(name)}>
								{name}
							</button>
							<button
								type="button"
								class="preset-del"
								aria-label="Delete {name}"
								onclick={() => deletePreset(name)}>×</button
							>
						</li>
					{/each}
				</ul>
			{/if}
		</details>

		<!-- ── Actions ── -->
		<section class="actions">
			<button type="button" class="btn-primary font-terminal" onclick={copyAsCode}>
				{copied ? 'Copied ✓' : 'Copy as code'}
			</button>
			<button type="button" class="btn-ghost font-terminal" onclick={resetAll}>Reset all</button>
		</section>
	</aside>
{/if}

<style>
	.scene-bg {
		position: fixed;
		inset: 0;
		z-index: 0;
	}

	/* ── Loading overlay — covers everything until the model is painted ── */
	.scene-loading {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #020617;
	}
	.scene-loading-text {
		margin: 0;
		font-size: 0.9rem;
		letter-spacing: 0.08em;
		color: #00a5cf;
	}
	.cursor {
		display: inline-block;
		margin-left: 0.2em;
		color: #9fffcb;
		animation: blink 1s steps(1) infinite;
	}
	@keyframes blink {
		0%,
		49% {
			opacity: 1;
		}
		50%,
		100% {
			opacity: 0;
		}
	}

	/* ── Panel toggle ── */
	.panel-toggle {
		position: fixed;
		top: 5rem;
		right: 1rem;
		z-index: 60;
		background: rgba(2, 6, 23, 0.9);
		color: #00a5cf;
		border: 1px solid rgba(0, 165, 207, 0.45);
		font-size: 1rem;
		width: 2.25rem;
		height: 2.25rem;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.panel-toggle:hover {
		border-color: #9fffcb;
		color: #9fffcb;
	}

	/* ── Section jump navigation (top-left) ── */
	.jump-nav {
		position: fixed;
		top: 5rem;
		left: 1rem;
		z-index: 60;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.jump-toggle {
		background: rgba(2, 6, 23, 0.9);
		color: #00a5cf;
		border: 1px solid rgba(0, 165, 207, 0.45);
		font-size: 1rem;
		width: 2.25rem;
		height: 2.25rem;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.jump-toggle:hover {
		border-color: #9fffcb;
		color: #9fffcb;
	}
	.jump-list {
		margin-top: 0.25rem;
		display: flex;
		flex-direction: column;
		background: rgba(2, 6, 23, 0.92);
		border: 1px solid rgba(0, 165, 207, 0.35);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		min-width: 10rem;
	}
	.jump-item {
		background: transparent;
		border: 0;
		border-radius: 0;
		text-align: left;
		font-family: 'Space Mono', monospace;
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #94a3b8;
		padding: 0.35rem 0.6rem;
		cursor: pointer;
	}
	.jump-item:hover {
		color: #9fffcb;
		background: rgba(0, 165, 207, 0.08);
	}
	.jump-item + .jump-item {
		border-top: 1px solid rgba(0, 165, 207, 0.12);
	}

	/* ── Panel shell ── */
	.lab-panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 50;
		width: min(420px, 95vw);
		padding: 1rem 1rem 1.5rem;
		background: rgba(2, 6, 23, 0.92);
		border-left: 1px solid rgba(0, 165, 207, 0.35);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		overflow-y: auto;
		color: #cbd5e1;
		font-size: 0.85rem;
	}

	.panel-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 1.25rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(0, 165, 207, 0.25);
	}
	.title {
		margin: 0;
		font-size: 1.35rem;
		color: #e2f6ff;
		letter-spacing: 0.02em;
	}
	.hint {
		font-size: 0.66rem;
		color: #64748b;
		letter-spacing: 0.06em;
	}
	kbd {
		background: rgba(0, 165, 207, 0.15);
		border: 1px solid rgba(0, 165, 207, 0.45);
		padding: 0.05rem 0.35rem;
		font-family: inherit;
		color: #00a5cf;
	}

	/* ── Undo/redo history controls (panel header) ── */
	.hist-controls {
		display: flex;
		align-items: center;
		align-self: center;
		gap: 0.3rem;
	}
	.hist-btn {
		background: transparent;
		color: #00a5cf;
		border: 1px solid rgba(0, 165, 207, 0.45);
		border-radius: 0;
		width: 1.7rem;
		height: 1.7rem;
		padding: 0;
		font-size: 0.9rem;
		line-height: 1;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition:
			color 0.2s ease,
			border-color 0.2s ease;
	}
	.hist-btn:hover:not(:disabled) {
		border-color: #9fffcb;
		color: #9fffcb;
	}
	.hist-btn:disabled {
		opacity: 0.35;
		pointer-events: none;
		cursor: default;
	}
	.hist-counter {
		font-family: 'Space Mono', monospace;
		font-size: 0.62rem;
		color: #64748b;
		letter-spacing: 0.04em;
		min-width: 2.2rem;
		text-align: center;
	}

	/* ── Accordion groups + sub-cards ── */
	.group {
		margin-bottom: 0.6rem;
	}
	.group[open] {
		margin-bottom: 1.25rem;
	}
	.sec-head {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		list-style: none;
		cursor: pointer;
		user-select: none;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #9fffcb;
		padding: 0.32rem 0.55rem;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(37, 161, 142, 0.35);
	}
	.sec-head::-webkit-details-marker {
		display: none;
	}
	.sec-head::marker {
		content: '';
	}
	.sec-head:hover {
		border-color: #9fffcb;
	}
	.group[open] > .sec-head {
		margin-bottom: 0.6rem;
	}
	.caret {
		color: #00a5cf;
		font-size: 0.6rem;
		line-height: 1;
	}
	.sub {
		margin-bottom: 0.7rem;
		padding: 0.5rem 0.55rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(0, 165, 207, 0.14);
	}

	/* ── Knob rows ── */
	.row {
		display: grid;
		grid-template-columns: 6rem 1fr 4rem;
		align-items: center;
		gap: 0.5rem;
		padding: 0.18rem 0;
		font-size: 0.8rem;
	}
	.row.toggle {
		grid-template-columns: 1.2rem 1fr;
	}
	.row.disabled {
		opacity: 0.4;
	}
	.row span {
		font-family: 'Space Mono', monospace;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #94a3b8;
	}
	.row span.label {
		text-transform: none;
		letter-spacing: 0;
		color: #cbd5e1;
		font-size: 0.8rem;
	}
	.row output,
	.row code {
		font-family: 'Space Mono', monospace;
		font-size: 0.68rem;
		color: #00a5cf;
		text-align: right;
	}
	.row input[type='range'] {
		width: 100%;
		accent-color: #00a5cf;
	}
	.row input[type='color'] {
		width: 100%;
		height: 1.3rem;
		border: 1px solid rgba(0, 165, 207, 0.35);
		border-radius: 0;
		background: transparent;
		cursor: pointer;
		padding: 0;
	}
	.row input[type='checkbox'] {
		accent-color: #25a18e;
	}
	.hint-row {
		font-family: 'Space Mono', monospace;
		font-size: 0.64rem;
		color: #64748b;
		margin: 0.4rem 0 0.2rem;
	}

	/* ── Inputs / selects / buttons ── */
	.select {
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(0, 165, 207, 0.35);
		border-radius: 0;
		color: #cbd5e1;
		font-family: 'Space Mono', monospace;
		font-size: 0.74rem;
		padding: 0.25rem 0.4rem;
		width: 100%;
		cursor: pointer;
	}
	.select:focus {
		outline: none;
		border-color: #9fffcb;
	}
	.select:disabled {
		cursor: default;
	}

	.text-input {
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(0, 165, 207, 0.35);
		border-radius: 0;
		color: #cbd5e1;
		padding: 0.35rem 0.55rem;
		font-family: 'Space Mono', monospace;
		font-size: 0.76rem;
		width: 100%;
	}
	.text-input:focus {
		outline: none;
		border-color: #9fffcb;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(0, 165, 207, 0.25);
	}
	.btn-primary,
	.btn-ghost {
		font-size: 0.74rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.6rem 0.85rem;
		cursor: pointer;
		border-radius: 0;
		border: 0;
		transition:
			background 0.2s ease,
			color 0.2s ease,
			border-color 0.2s ease;
	}
	.btn-primary {
		background: #00a5cf;
		color: #020617;
	}
	.btn-primary:hover {
		background: #9fffcb;
	}
	.btn-ghost {
		background: transparent;
		color: #00a5cf;
		border: 1px solid rgba(0, 165, 207, 0.45);
	}
	.btn-ghost:hover {
		border-color: #9fffcb;
		color: #9fffcb;
	}
	.btn-small {
		padding: 0.35rem 0.7rem;
		font-size: 0.68rem;
		font-family: 'Space Mono', monospace;
	}

	/* ── Preset list ── */
	.preset-list {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.preset-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem;
	}
	.preset-load {
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(0, 165, 207, 0.2);
		border-radius: 0;
		color: #cbd5e1;
		font-size: 0.74rem;
		text-align: left;
		padding: 0.4rem 0.55rem;
		cursor: pointer;
	}
	.preset-load:hover {
		border-color: #9fffcb;
		color: #9fffcb;
	}
	.preset-del {
		background: transparent;
		border: 1px solid rgba(0, 165, 207, 0.2);
		border-radius: 0;
		color: #94a3b8;
		font-size: 1rem;
		width: 1.9rem;
		cursor: pointer;
	}
	.preset-del:hover {
		border-color: #ef4444;
		color: #ef4444;
	}
</style>

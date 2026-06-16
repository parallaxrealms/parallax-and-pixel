<script lang="ts">
	// Tab-level "View in DAEDALUS" button. Pass a `build` fn (computed at click
	// time, so it captures the tab's current data) or a static `scene`.
	import { Shapes } from 'lucide-svelte';
	import DaedalusDialog from './DaedalusDialog.svelte';
	import type { SceneDoc } from './schema';

	let {
		scene,
		build,
		label = 'View in DAEDALUS',
		iconOnly = false,
		title = 'Visualize in DAEDALUS',
		class: className = ''
	}: {
		scene?: SceneDoc;
		build?: () => SceneDoc;
		label?: string;
		iconOnly?: boolean;
		title?: string;
		class?: string;
	} = $props();

	let open = $state(false);
	let resolved = $state<SceneDoc | null>(null);

	function show() {
		resolved = build ? build() : (scene ?? null);
		open = true;
	}
</script>

<button type="button" class="dq-btn {className}" {title} onclick={show}>
	<Shapes size={14} strokeWidth={1.75} />
	{#if !iconOnly}<span>{label}</span>{/if}
</button>

<DaedalusDialog bind:open scene={resolved} />

<style>
	.dq-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.6rem; /* ≥ touch-friendly height */
		font-size: 0.72rem;
		font-weight: 600;
		color: #94a3b8; /* slate-400 */
		background: #1e293b; /* slate-800 */
		border: 1px solid #334155; /* slate-700 */
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.dq-btn:hover {
		color: var(--accent-primary, #00a5cf);
		border-color: var(--accent-primary, #00a5cf);
	}
</style>

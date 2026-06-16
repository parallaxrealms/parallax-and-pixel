import type { SceneDoc } from '../schema';

// Component-level tint — a single runtime, so one coherent blue family plus a
// slate for the external harness it bridges to.
const C = {
	core: '#3b82f6',
	io: '#38bdf8',
	external: '#64748b'
};

/**
 * pi-agent-core — the Level-3 component graph reached by drilling the
 * `pi-agent-core` node of `bifrost-client`. It sketches the agent runtime's
 * internal pieces and the bridge out to `pi-coding-harness`.
 *
 * Kept deliberately high-level: these are the *relationships* a runtime of this
 * shape has (loop ↔ model client ↔ tools ↔ memory), not claims about private
 * internals the repo/docs don't pin down.
 */
export const piAgentCoreScene: SceneDoc = {
	id: 'pi-agent-core',
	slug: 'pi-agent-core',
	name: 'pi-agent-core — Runtime Internals',
	description: 'The agent loop inside the runtime the realm-agents run on.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'pi-agent-core' },
		groups: [
			{ id: 'core', label: 'pi-agent-core', color: C.core },
			{ id: 'external', label: 'External', color: C.external }
		],
		nodes: [
			{
				id: 'tool-loop',
				label: 'Tool loop',
				group: 'core',
				color: C.core,
				panel: `**The agent loop** — the orchestrator at the centre of the runtime.

- Drives the call → tool-dispatch → observe cycle until the task settles
- Pulls context in and writes results/memory back out each turn`
			},
			{
				id: 'model-client',
				label: 'Model client',
				group: 'core',
				color: C.io,
				panel: `**The model interface.**

- Sends prompts to the provider chosen by the budget-aware tier ladder (FREE → HAIKU → SONNET → OPUS)
- Returns completions / tool-call requests back to the loop`
			},
			{
				id: 'context-memory',
				label: 'Context / memory',
				group: 'core',
				color: C.io,
				panel: `**Working context and persistence.**

- Assembles the per-turn context window for the loop
- Persists across turns to the agent's own store (each realm-agent has its own SQLite DB)`
			},
			{
				id: 'harness-bridge',
				label: 'Harness bridge',
				group: 'core',
				color: C.io,
				panel: `**The bridge to the coding harness.**

- Exposes file-editing / command-running as tools the loop can call
- Routes those calls out to \`pi-coding-harness\``
			},
			{
				id: 'pi-coding-harness',
				label: 'pi-coding-harness',
				group: 'external',
				color: C.external,
				panel: `**The coding harness** (a separate pi-runtime package).

- Performs the actual code edits / command runs for repos in the agent's PAT scope
- Driven through the harness bridge; not part of \`pi-agent-core\` itself`
			}
		],
		edges: [
			{ source: 'tool-loop', target: 'model-client', kind: 'sync', label: 'prompt', animated: true },
			{ source: 'tool-loop', target: 'context-memory', kind: 'data', label: 'read/write' },
			{ source: 'tool-loop', target: 'harness-bridge', kind: 'dep', label: 'tools' },
			{ source: 'harness-bridge', target: 'pi-coding-harness', kind: 'sync', label: 'invoke' }
		]
	}
};

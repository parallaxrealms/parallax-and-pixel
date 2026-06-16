import type { SceneDoc } from '../schema';

// Sample sankey — agent request flow down the model-tier ladder.
// Requests enter, are routed by the budget-aware tier ladder
// FREE → HAIKU → SONNET → OPUS, and exit as completed responses.
// Demonstrates VizEdge.value (flow magnitude → ribbon width).
const C = {
	intake: '#64748b',
	free: '#14b8a6',
	haiku: '#22c55e',
	sonnet: '#4d7cff',
	opus: '#a855f7',
	done: '#f5a623'
};

export const sampleSankeyScene: SceneDoc = {
	id: 'sample-sankey',
	slug: 'sample-sankey',
	name: 'Sample — Model-Tier Flow',
	description: 'Agent requests routed down the budget-aware tier ladder FREE → HAIKU → SONNET → OPUS.',
	primitive: 'sankey',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Model-Tier Flow' },
		nodes: [
			{ id: 'requests', label: 'Agent requests', color: C.intake },
			{ id: 'free', label: 'FREE', color: C.free },
			{ id: 'haiku', label: 'HAIKU', color: C.haiku },
			{ id: 'sonnet', label: 'SONNET', color: C.sonnet },
			{ id: 'opus', label: 'OPUS', color: C.opus },
			{ id: 'completed', label: 'Completed', color: C.done }
		],
		edges: [
			{ source: 'requests', target: 'free', value: 120 },
			{ source: 'requests', target: 'haiku', value: 60 },
			{ source: 'free', target: 'haiku', value: 34 },
			{ source: 'haiku', target: 'sonnet', value: 48 },
			{ source: 'sonnet', target: 'opus', value: 18 },
			{ source: 'free', target: 'completed', value: 86 },
			{ source: 'haiku', target: 'completed', value: 46 },
			{ source: 'sonnet', target: 'completed', value: 30 },
			{ source: 'opus', target: 'completed', value: 18 }
		]
	}
};

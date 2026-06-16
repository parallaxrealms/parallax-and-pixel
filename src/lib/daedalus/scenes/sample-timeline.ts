import type { SceneDoc } from '../schema';

// Sample timeline — a day of operations across three tracks: deploys, the
// agent run loop, and incidents. Demonstrates VizTimelineTrack with ISO
// start/end segments and per-state coloring.
const D = (h: number, m = 0) =>
	new Date(Date.UTC(2026, 5, 1, h, m, 0)).toISOString();

export const sampleTimelineScene: SceneDoc = {
	id: 'sample-timeline',
	slug: 'sample-timeline',
	name: 'Sample — Ops Timeline',
	description: 'A day of deploys, agent run states, and incidents across three tracks.',
	primitive: 'timeline',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Ops Timeline' },
		timeline: [
			{
				id: 'deploys',
				label: 'Deploys',
				segments: [
					{ start: D(2, 10), end: D(2, 24), state: 'success', label: 'v1.4.0' },
					{ start: D(9, 5), end: D(9, 22), state: 'success', label: 'v1.4.1' },
					{ start: D(14, 40), end: D(15, 5), state: 'failed', label: 'v1.5.0 rollback' },
					{ start: D(16, 0), end: D(16, 18), state: 'success', label: 'v1.5.1' }
				]
			},
			{
				id: 'agent',
				label: 'Satori agent',
				segments: [
					{ start: D(0), end: D(6), state: 'idle' },
					{ start: D(6), end: D(8, 30), state: 'running', label: 'morning brief' },
					{ start: D(8, 30), end: D(12), state: 'idle' },
					{ start: D(12), end: D(13), state: 'running', label: 'PM sync' },
					{ start: D(13), end: D(18), state: 'idle' },
					{ start: D(18), end: D(19, 30), state: 'running', label: 'EOD digest' },
					{ start: D(19, 30), end: D(24), state: 'idle' }
				]
			},
			{
				id: 'incidents',
				label: 'Incidents',
				segments: [
					{ start: D(14, 38), end: D(15, 10), state: 'critical', label: 'deploy 5xx' },
					{ start: D(20, 0), end: D(20, 25), state: 'warning', label: 'CPU spike' }
				]
			}
		]
	}
};

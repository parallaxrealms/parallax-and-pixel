import type { SceneDoc } from '../schema';

// Sample heatmap — host CPU utilization (%) across the week, by hour bucket.
// Demonstrates VizMatrix: xLabels (time-of-day buckets) × yLabels (weekdays),
// row-major values[y][x], ascending thresholds, and a unit suffix.
export const sampleHeatmapScene: SceneDoc = {
	id: 'sample-heatmap',
	slug: 'sample-heatmap',
	name: 'Sample — Host CPU by Hour',
	description: 'CPU utilization (%) on satori-daemon-hel1 across the week, by 4-hour bucket.',
	primitive: 'heatmap',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Host CPU by Hour' },
		matrix: {
			unit: '%',
			xLabels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
			yLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
			// values[y][x] — row per weekday, column per 4-hour bucket
			values: [
				[18, 14, 41, 67, 72, 38],
				[21, 16, 48, 71, 69, 35],
				[19, 15, 52, 74, 81, 44],
				[24, 18, 55, 79, 88, 51],
				[28, 22, 61, 84, 91, 58],
				[31, 26, 39, 47, 53, 62],
				[22, 17, 29, 33, 41, 48]
			],
			thresholds: [
				{ at: 0, color: '#14b8a6' },
				{ at: 50, color: '#f5a623' },
				{ at: 80, color: '#f43f5e' }
			]
		}
	}
};

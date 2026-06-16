import type { SceneDoc } from '../schema';

// Sample treemap — Supabase storage by bucket, two levels deep: each bucket
// splits into its largest object classes. Demonstrates node.value as leaf
// size + edges encoding the parent→child hierarchy.
const C = {
	realms: '#4d7cff',
	exports: '#14b8a6',
	assets: '#f5a623',
	backups: '#a855f7'
};

export const sampleTreemapScene: SceneDoc = {
	id: 'sample-treemap',
	slug: 'sample-treemap',
	name: 'Sample — Storage by Bucket',
	description: 'Supabase storage footprint (GB) split by bucket and object class.',
	primitive: 'treemap',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Storage by Bucket' },
		nodes: [
			{ id: 'storage', label: 'Storage' },
			// bucket: 9realms
			{ id: '9realms', label: '9realms', color: C.realms },
			{ id: '9realms-uploads', label: 'Uploads', value: 42, color: C.realms },
			{ id: '9realms-thumbs', label: 'Thumbnails', value: 11, color: C.realms },
			// bucket: daedalus-exports
			{ id: 'exports', label: 'daedalus-exports', color: C.exports },
			{ id: 'exports-pdf', label: 'Explainer PDFs', value: 18, color: C.exports },
			{ id: 'exports-png', label: 'PNG snapshots', value: 7, color: C.exports },
			// bucket: site-assets
			{ id: 'assets', label: 'site-assets', color: C.assets },
			{ id: 'assets-images', label: 'Images', value: 64, color: C.assets },
			{ id: 'assets-fonts', label: 'Fonts', value: 5, color: C.assets },
			// bucket: backups
			{ id: 'backups', label: 'backups', color: C.backups },
			{ id: 'backups-db', label: 'DB dumps', value: 29, color: C.backups },
			{ id: 'backups-logs', label: 'Log archives', value: 13, color: C.backups }
		],
		edges: [
			{ source: 'storage', target: '9realms' },
			{ source: 'storage', target: 'exports' },
			{ source: 'storage', target: 'assets' },
			{ source: 'storage', target: 'backups' },
			{ source: '9realms', target: '9realms-uploads' },
			{ source: '9realms', target: '9realms-thumbs' },
			{ source: 'exports', target: 'exports-pdf' },
			{ source: 'exports', target: 'exports-png' },
			{ source: 'assets', target: 'assets-images' },
			{ source: 'assets', target: 'assets-fonts' },
			{ source: 'backups', target: 'backups-db' },
			{ source: 'backups', target: 'backups-logs' }
		]
	}
};

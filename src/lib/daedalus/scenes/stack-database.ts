import type { SceneDoc } from '../schema';

// Group tints — Postgres (teal), Access (green security), Tenancy (blue), Storage/cache (slate).
const C = {
	postgres: '#14b8a6',
	access: '#22c55e',
	tenancy: '#3b82f6',
	storage: '#64748b'
};

/**
 * Database & Storage — the Level-2 drill-down behind the "Database & Storage"
 * cylinder of `9realms-stack`. Draws the `nine` schema, RLS, the `site_id`
 * multi-tenant boundary, cache-first JSON loading, and the Storage bucket.
 * Authored from the stack panel + `CLAUDE.md` / `ref/9REALMS.md`. High-level
 * where exact internals aren't known from the repo/docs.
 */
export const databaseStackScene: SceneDoc = {
	id: 'stack-database',
	slug: 'stack-database',
	name: 'Database & Storage — Supabase Postgres',
	description: 'The nine schema, RLS, multi-tenant site_id, cache-first JSON, Storage.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Database & Storage' },
		groups: [
			{ id: 'postgres', label: 'Postgres', color: C.postgres },
			{ id: 'access', label: 'Access control', color: C.access },
			{ id: 'tenancy', label: 'Multi-tenancy', color: C.tenancy },
			{ id: 'storage', label: 'Storage & cache', color: C.storage }
		],
		nodes: [
			{
				id: 'supabase',
				label: 'Supabase Postgres',
				group: 'postgres',
				color: C.postgres,
				panel: `**The system of record.**

- Managed Postgres behind Supabase
- Holds both the \`public\` (team) and \`nine\` (admin) schemas
- Reached from the server, never directly from the browser`
			},
			{
				id: 'nine-schema',
				label: 'nine schema',
				group: 'postgres',
				color: C.postgres,
				panel: `**The admin schema** (renamed from \`odin\` this cycle).

- Houses the dashboard's own admin tables
- Admin-only access via \`nine.is_admin()\`
- The future \`nine.daedalus_scenes\` table will persist visualization scenes`
			},
			{
				id: 'public-schema',
				label: 'public schema',
				group: 'postgres',
				color: C.postgres,
				panel: `**The team / tenant-facing schema.**

- Team-based access via the \`user_roles\` table (admin / power-user / client)
- Where the multi-tenant business data lives`
			},
			{
				id: 'rls',
				label: 'Row-Level Security',
				group: 'access',
				color: C.access,
				panel: `**Per-row authorization, enforced in Postgres.**

- \`public\`: team-based via \`user_roles\`
- \`nine\`: admin-only via \`nine.is_admin()\`
- Pairs with \`GRANT\` as a second, independent layer`
			},
			{
				id: 'site-id',
				label: 'site_id tenancy',
				group: 'tenancy',
				color: C.tenancy,
				panel: `**Multi-tenant via a \`site_id\` TEXT column.**

- Always filter by \`site_id\` — the \`set_config('app.site_id', …)\` pattern is **deprecated**
- A shared filter helper applies it everywhere
- The boundary that keeps tenants apart`
			},
			{
				id: 'cache',
				label: 'cache-first JSON',
				group: 'storage',
				color: C.storage,
				panel: `**Cache-first loading.**

- Per-tenant JSON snapshots under \`.cache/{site_id}/{table}.json\`
- Read from cache first, fall through to Postgres
- Keeps reads cheap and fast for hot tables`
			},
			{
				id: 'bucket',
				label: 'Storage bucket',
				group: 'storage',
				color: C.storage,
				panel: `**Supabase Storage** — the \`9realms\` bucket.

- Holds media / assets for the dashboard
- Object reads/writes go through the server layer`
			}
		],
		edges: [
			{ source: 'supabase', target: 'nine-schema', kind: 'dep', label: 'contains' },
			{ source: 'supabase', target: 'public-schema', kind: 'dep', label: 'contains' },
			{ source: 'rls', target: 'nine-schema', kind: 'data', label: 'is_admin()' },
			{ source: 'rls', target: 'public-schema', kind: 'data', label: 'user_roles' },
			{ source: 'site-id', target: 'public-schema', kind: 'data', label: 'filters' },
			{ source: 'cache', target: 'supabase', kind: 'data', label: 'falls back to', animated: true },
			{ source: 'site-id', target: 'cache', kind: 'dep', label: 'keys' },
			{ source: 'supabase', target: 'bucket', kind: 'dep', label: 'co-located' }
		]
	}
};

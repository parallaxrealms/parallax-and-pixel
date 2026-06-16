import type { SceneDoc } from '../schema';

// Group tints — Postgres layers (orange security), Tenancy (blue), Boundaries (green).
const C = {
	pg: '#f97316',
	tenancy: '#3b82f6',
	boundary: '#22c55e'
};

/**
 * Security & RLS — the Level-2 drill-down behind the "Security & RLS" cylinder
 * of `9realms-stack`. Draws the two-layer Postgres security model (GRANT + RLS),
 * per-tenant `site_id` filtering, and the credential-boundary-over-policy-
 * boundary posture. Authored from the stack panel + `CLAUDE.md`. High-level
 * where exact internals aren't known from the repo/docs.
 */
export const securityStackScene: SceneDoc = {
	id: 'stack-security',
	slug: 'stack-security',
	name: 'Security & RLS — Two-Layer Postgres + Boundaries',
	description: 'GRANT + RLS as two layers, site_id filtering, credential boundaries.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Security & RLS' },
		groups: [
			{ id: 'pg', label: 'Postgres security', color: C.pg },
			{ id: 'tenancy', label: 'Tenant isolation', color: C.tenancy },
			{ id: 'boundary', label: 'Boundaries', color: C.boundary }
		],
		nodes: [
			{
				id: 'grant',
				label: 'GRANT',
				group: 'pg',
				color: C.pg,
				panel: `**Layer one — coarse table privileges.**

- Postgres \`GRANT\` controls which roles can touch which objects
- An independent layer beneath RLS (Postgres-general pattern)`
			},
			{
				id: 'rls',
				label: 'Row-Level Security',
				group: 'pg',
				color: C.pg,
				panel: `**Layer two — per-row policy.**

- \`public\`: team-based via \`user_roles\`
- \`nine\`: admin-only via \`nine.is_admin()\`
- Two independent layers, so a gap in one isn't a breach`
			},
			{
				id: 'site-filter',
				label: 'site_id filtering',
				group: 'tenancy',
				color: C.tenancy,
				panel: `**Per-tenant isolation, applied everywhere.**

- Every query filters by \`site_id\` (a shared filter helper)
- The \`set_config('app.site_id', …)\` pattern is **deprecated**
- The boundary that keeps tenants from seeing each other`
			},
			{
				id: 'cred-boundary',
				label: 'Credential boundaries',
				group: 'boundary',
				color: C.boundary,
				panel: `**Boundaries that beat policy.**

- Prefer credential boundaries over prompt-injection-vulnerable policy boundaries
- Especially in agent land: scope the key, don't trust the prompt
- A boundary the LLM can't talk its way past`
			},
			{
				id: 'pitfalls',
				label: 'Logged pitfalls',
				group: 'boundary',
				color: C.boundary,
				panel: `**Lessons captured as pitfalls.**

- E.g. unconditional triggers on the shared \`auth.users\` table
- Recorded so the same trap isn't re-walked
- Feeds the "treat shared boundaries carefully" rule`
			}
		],
		edges: [
			{ source: 'grant', target: 'rls', kind: 'dep', label: 'paired with' },
			{ source: 'site-filter', target: 'rls', kind: 'dep', label: 'reinforces' },
			{ source: 'cred-boundary', target: 'site-filter', kind: 'dep', label: 'over policy' },
			{ source: 'pitfalls', target: 'cred-boundary', kind: 'dep', label: 'informs' }
		]
	}
};

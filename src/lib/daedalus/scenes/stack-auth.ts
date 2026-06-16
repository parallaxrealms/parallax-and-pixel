import type { SceneDoc } from '../schema';

// Group tints — Identity (green), Authorization (teal), Guard (blue), Tenant boundary (slate).
const C = {
	identity: '#22c55e',
	authz: '#14b8a6',
	guard: '#3b82f6',
	boundary: '#64748b'
};

/**
 * Auth & Permissions — the Level-2 drill-down behind the "Auth & Permissions"
 * cylinder of `9realms-stack`. Draws Supabase Auth, JWT validation, RLS + team
 * roles, the server route guard, and the shared `auth.users` boundary in
 * multi-tenant land. Authored from the stack panel + `CLAUDE.md`. High-level
 * where exact internals aren't known from the repo/docs.
 */
export const authStackScene: SceneDoc = {
	id: 'stack-auth',
	slug: 'stack-auth',
	name: 'Auth & Permissions — Supabase Auth + RLS',
	description: 'Identity, JWT, RLS team roles, the route guard, the auth.users boundary.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Auth & Permissions' },
		groups: [
			{ id: 'identity', label: 'Identity', color: C.identity },
			{ id: 'authz', label: 'Authorization', color: C.authz },
			{ id: 'guard', label: 'Route guard', color: C.guard },
			{ id: 'boundary', label: 'Shared boundary', color: C.boundary }
		],
		nodes: [
			{
				id: 'supabase-auth',
				label: 'Supabase Auth',
				group: 'identity',
				color: C.identity,
				panel: `**Who you are.**

- Magic-link + OAuth sign-in
- Issues the JWT the rest of the stack trusts
- Backed by the shared \`auth.users\` table`
			},
			{
				id: 'jwt',
				label: 'JWT',
				group: 'identity',
				color: C.identity,
				panel: `**The signed claim.**

- Validated locally (no per-request round-trip to the auth server)
- Carries the user identity used downstream for roles and RLS`
			},
			{
				id: 'roles',
				label: 'Team roles',
				group: 'authz',
				color: C.authz,
				panel: `**What you can do.**

- \`user_roles\` table: admin / power-user / client
- \`nine\` schema is admin-only via \`nine.is_admin()\`
- Drives both RLS and per-route role checks`
			},
			{
				id: 'rls',
				label: 'Row-Level Security',
				group: 'authz',
				color: C.authz,
				panel: `**Postgres-enforced authorization.**

- \`public\`: team-based via \`user_roles\`
- \`nine\`: admin-only via \`nine.is_admin()\`
- The last line of defense, independent of app code`
			},
			{
				id: 'hooks-guard',
				label: 'Server route guard',
				group: 'guard',
				color: C.guard,
				panel: `**Defense in depth at the edge.**

- A \`hooks.server.ts\` guard gates the \`(admin)\` routes
- Per-route role checks layer on top of the global guard
- The UI gate is backed by RLS, so a bypass still fails at the DB`
			},
			{
				id: 'auth-users',
				label: 'auth.users',
				group: 'boundary',
				color: C.boundary,
				panel: `**The shared user table** — treated carefully in multi-tenant land.

- Spans all tenants, so triggers/policies on it are high-blast-radius
- A logged pitfall: unconditional triggers on shared \`auth.users\`
- Crossing this boundary needs extra care`
			}
		],
		edges: [
			{ source: 'supabase-auth', target: 'jwt', kind: 'dep', label: 'issues' },
			{ source: 'supabase-auth', target: 'auth-users', kind: 'data', label: 'backed by' },
			{ source: 'jwt', target: 'hooks-guard', kind: 'sync', label: 'validated', animated: true },
			{ source: 'hooks-guard', target: 'roles', kind: 'sync', label: 'checks' },
			{ source: 'roles', target: 'rls', kind: 'dep', label: 'drives' },
			{ source: 'roles', target: 'auth-users', kind: 'data', label: 'keyed on' }
		]
	}
};

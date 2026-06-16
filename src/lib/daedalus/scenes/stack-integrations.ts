import type { SceneDoc } from '../schema';

// Group tints — Payments (sky), Email (green), AI/media (violet), Site audits (amber).
const C = {
	payments: '#38bdf8',
	email: '#22c55e',
	ai: '#a855f7',
	audit: '#f5a623'
};

/**
 * Payments & Integrations — the Level-2 drill-down behind the "Payments &
 * Integrations" cylinder of `9realms-stack`. Draws the outward-facing
 * third-party services: dual-path payments (Stripe + Square), Resend
 * transactional email, Replicate image generation, and Firecrawl + Lighthouse
 * site audits. Authored from the stack panel + `CLAUDE.md`. High-level where
 * exact internals aren't known from the repo/docs.
 */
export const integrationsStackScene: SceneDoc = {
	id: 'stack-integrations',
	slug: 'stack-integrations',
	name: 'Payments & Integrations — Talking to the Outside World',
	description: 'Stripe + Square payments, Resend email, Replicate, Firecrawl + Lighthouse.',
	primitive: 'graph',
	dimension: '2d',
	boundAdapter: null,
	style: { contentFont: 'sans' },
	data: {
		meta: { title: 'Payments & Integrations' },
		groups: [
			{ id: 'payments', label: 'Payments', color: C.payments },
			{ id: 'email', label: 'Email', color: C.email },
			{ id: 'ai', label: 'AI / media', color: C.ai },
			{ id: 'audit', label: 'Site audits', color: C.audit }
		],
		nodes: [
			{
				id: 'api',
				label: 'API layer',
				group: 'payments',
				color: '#3b82f6',
				panel: `**The server-side caller** that fans out to the integrations.

- Holds the third-party credentials (kept off the client)
- Each integration is reached over HTTPS from here
- Drill into the system view for the full backend`,
				link: { sceneId: '9realms-architecture', label: 'System architecture' }
			},
			{
				id: 'stripe',
				label: 'Stripe',
				group: 'payments',
				color: C.payments,
				panel: `**Card payments — one of two paths.**

- Checkout, invoices, subscriptions
- Part of the intentionally-leaky dual-path payments abstraction`
			},
			{
				id: 'square',
				label: 'Square',
				group: 'payments',
				color: C.payments,
				panel: `**The second payments path.**

- Runs alongside Stripe rather than behind a single facade
- The abstraction is deliberately leaky — each provider's specifics show through`
			},
			{
				id: 'resend',
				label: 'Resend',
				group: 'email',
				color: C.email,
				panel: `**Transactional email.**

- Sends the dashboard's transactional mail
- Also wired as the Send Email Hook for auth mail`
			},
			{
				id: 'replicate',
				label: 'Replicate',
				group: 'ai',
				color: C.ai,
				panel: `**Image generation.**

- Used for image-generation workloads
- Reached over HTTPS from the server`
			},
			{
				id: 'firecrawl',
				label: 'Firecrawl',
				group: 'audit',
				color: C.audit,
				panel: `**Web scraping for site audits.**

- Pulls page content for analysis
- One half of the site-audit toolset`
			},
			{
				id: 'lighthouse',
				label: 'Lighthouse',
				group: 'audit',
				color: C.audit,
				panel: `**Performance / quality audits.**

- Lighthouse runs for site audits
- Pairs with Firecrawl on the audit path`
			}
		],
		edges: [
			{ source: 'api', target: 'stripe', kind: 'sync', label: 'HTTPS' },
			{ source: 'api', target: 'square', kind: 'sync', label: 'HTTPS' },
			{ source: 'api', target: 'resend', kind: 'sync', label: 'send mail' },
			{ source: 'api', target: 'replicate', kind: 'sync', label: 'generate' },
			{ source: 'api', target: 'firecrawl', kind: 'sync', label: 'scrape' },
			{ source: 'api', target: 'lighthouse', kind: 'sync', label: 'audit' }
		]
	}
};

// Canonical realm-agent registry for the Bifrost chat client.
//
// The daemon owns the authoritative persona (the SOUL files) and validates the
// agent on every create/rename/turn. This module is the *frontend's* view: which
// agents are user-selectable today and their display metadata (name, avatar,
// tagline). Keeping it in one place means the switcher, the sidebar badges, the
// session theming, and the store all agree on the slate.
//
// To bring a new realm-agent online (Heimdall, Thoth, …): give it a SOUL file in
// bifrost-daemon, add its key to the daemon's KNOWN_AGENTS, then add a row here.
// Per-agent colors live in `bifrostSessionColors.ts` (colorForAgent) and already
// cover the full slate.

export type AgentKey = 'satori' | 'mimir' | 'heimdall' | 'thoth';

export interface AgentMeta {
	key: AgentKey;
	/** Human-readable name for headers, placeholders, the picker. */
	name: string;
	/** Avatar shown in the sidebar header for the active agent. */
	avatar: string;
	/** One-line description for the picker. */
	tagline: string;
	/** Short role title, e.g. 'Project Manager'. */
	role: string;
	/** One-line personality / voice descriptor. */
	personality: string;
	/** Runtime stack the agent runs on. */
	stack: 'pi-agent-core' | 'pi-coding-agent';
	/** Default model tier label, e.g. 'Haiku', 'Sonnet', 'Auto'. */
	defaultModel: string;
	/** Domain / lane the agent owns. */
	domain: string;
	status: 'live' | 'planned';
	/** Capability radar values (0–5), aligned to AGENT_AXES order. */
	stats: number[];
}

// Radar axes for the Agents tab. Data-driven: change a label or a value here and
// the cards/radar follow — no component edits. Order matches each agent's `stats`.
export const AGENT_AXES = ['Knowledge', 'Reasoning', 'Autonomy', 'Rigor', 'Caution', 'Memory'] as const;

// Order here is the picker order. Satori + Mimir + Heimdall are live; planned
// agents live in ROADMAP_AGENTS (shown on the Agents tab, not the picker).
export const AGENTS: AgentMeta[] = [
	{
		key: 'satori',
		name: 'Satori',
		avatar: '/satori_default.webp',
		tagline: 'The firm’s agent — calm, terse, oriented to what’s next.',
		role: 'Project Manager',
		personality: 'Calm, terse, oriented to what’s next.',
		stack: 'pi-agent-core',
		defaultModel: 'Haiku',
		domain: 'The firm — briefing, tasks, scoped 9realms writes',
		status: 'live',
		stats: [3, 3, 4, 3, 3, 4]
	},
	{
		key: 'mimir',
		name: 'Mimir',
		avatar: '/mimir_default.webp',
		tagline: 'Researcher — digests and synthesizes from the well.',
		role: 'Researcher',
		personality: 'Measured, precise, dry — the long memory.',
		stack: 'pi-agent-core',
		defaultModel: 'Sonnet',
		domain: 'The well — patterns, pitfalls, decisions',
		status: 'live',
		stats: [5, 5, 2, 5, 4, 4]
	},
	{
		key: 'heimdall',
		name: 'Heimdall',
		avatar: '/heimdall_default.webp',
		tagline: 'Watcher — read-only counsel on servers, sites, and deploys.',
		role: 'Infra Watcher',
		personality: 'Vigilant, calm, severity-aware.',
		stack: 'pi-agent-core',
		defaultModel: 'Auto',
		domain: 'Servers, sites, deploys — advise only',
		status: 'live',
		stats: [2, 4, 1, 4, 5, 1]
	},
	{
		key: 'thoth',
		name: 'Thoth',
		avatar: '/thoth_default.webp',
		tagline: 'Writing mentor — outlines, critique, and the well-turned phrase.',
		role: 'Writing Mentor',
		personality: 'Literate, articulate, encouraging — the measured word.',
		stack: 'pi-agent-core',
		defaultModel: 'Haiku',
		domain: 'Writing — drafts, blog, email, craft',
		status: 'live',
		stats: [4, 4, 1, 4, 3, 3]
	}
];

/** Roadmap agents — not yet live; shown on the Agents tab, excluded from the picker. */
export const ROADMAP_AGENTS: Array<{
	name: string;
	role: string;
	stack: 'pi-agent-core' | 'pi-coding-agent';
	domain: string;
	status: 'planned';
}> = [
	{ name: 'Odin', role: 'Coding Harness', stack: 'pi-coding-agent', domain: 'Multi-file coding, terminal, gated deploys', status: 'planned' }
];

export const AGENT_KEYS: AgentKey[] = AGENTS.map((a) => a.key);
export const DEFAULT_AGENT: AgentKey = 'satori';

const BY_KEY = new Map<AgentKey, AgentMeta>(AGENTS.map((a) => [a.key, a]));

/** Coerce an arbitrary string to a selectable agent key, falling back to the default. */
export function resolveAgentKey(key?: string | null): AgentKey {
	return key && BY_KEY.has(key as AgentKey) ? (key as AgentKey) : DEFAULT_AGENT;
}

/** Display metadata for an agent key (resolved/validated). Never returns undefined. */
export function agentMeta(key?: string | null): AgentMeta {
	return BY_KEY.get(resolveAgentKey(key)) as AgentMeta;
}

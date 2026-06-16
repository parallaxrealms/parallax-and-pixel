// Per-session color system for BIFROST — the rainbow bridge to the agents.
//
// Bifrost is the daemon that hosts the agents; each agent you session with gets
// its own band of the rainbow so concurrent sessions stay visually distinct.
// The palette is a *muted* ROYGBIV: low-saturation, dark-mode-appropriate hues
// so a session background reads as a subtle wash rather than a garish block,
// while the accent (borders/headers) carries a stronger version of the same hue.
//
// Assignment is deterministic: the same agent id always maps to the same band,
// so a session's color is stable across reloads and across the app. Known agents
// are pinned to specific bands (so they keep a recognizable identity as they come
// online); unknown ids hash into the palette.

export interface SessionColor {
	/** Subtle low-opacity wash, suitable as a full session background. */
	bg: string;
	/** Stronger version of the hue, for borders / headers / active accents. */
	accent: string;
	/** Human-readable name for the hue (e.g. "coral"). */
	label: string;
}

/**
 * The muted rainbow — 7 desaturated bands spanning ROYGBIV.
 * `bg` is a faint wash (alpha ~0.10), `accent` the saturated edge color.
 */
const PALETTE: SessionColor[] = [
	{ label: 'coral', bg: 'rgba(248, 113, 113, 0.10)', accent: '#f87171' }, // red — warm coral
	{ label: 'amber', bg: 'rgba(251, 146, 60, 0.10)', accent: '#fb923c' }, // orange
	{ label: 'gold', bg: 'rgba(250, 204, 21, 0.10)', accent: '#facc15' }, // yellow
	{ label: 'sage', bg: 'rgba(74, 222, 128, 0.10)', accent: '#4ade80' }, // green
	{ label: 'sky', bg: 'rgba(56, 189, 248, 0.10)', accent: '#38bdf8' }, // blue — cyan/sky
	{ label: 'indigo', bg: 'rgba(129, 140, 248, 0.10)', accent: '#818cf8' }, // indigo — the bridge hue
	{ label: 'violet', bg: 'rgba(192, 132, 252, 0.10)', accent: '#c084fc' } // violet
];

/**
 * Explicit, stable band assignments for known agents.
 *
 * `satori` is the only live agent today and gets a definite warm coral.
 * The remaining future agents are pre-assigned distinct bands across the
 * spectrum so they read as visually separate the moment they come online.
 * Values are indices into PALETTE.
 */
const AGENT_BANDS: Record<string, number> = {
	satori: 0, // coral  (live)
	vulcan: 1, // amber
	odin: 2, // gold
	heimdall: 3, // sage
	thoth: 4, // sky
	mimir: 5, // indigo (future agent, hosted inside Bifrost)
	bifrost: 6 // violet (the bridge itself, when addressed as an agent)
};

/**
 * Live agents whose session color should match their dashboard mode theme
 * (app.css `.theme-<agent>`) rather than a generic rainbow band — so the session
 * background reads as that agent's own brand. Satori = teal (`.theme-satori`),
 * with a soft gradient wash for a richer, mode-aligned aesthetic. Takes priority
 * over AGENT_BANDS. Future agents join here as their themes settle.
 */
const AGENT_THEME: Record<string, SessionColor> = {
	satori: {
		label: 'teal',
		bg: 'linear-gradient(180deg, rgba(13, 148, 136, 0.13), rgba(13, 148, 136, 0.03))',
		accent: '#2dd4bf'
	},
	// Heimdall mode is silver/white (app.css .theme-heimdall: --mode-primary #e5e7eb,
	// accent #fff) — the watchman's cold, bright palette. Match it so the chat wash
	// reads as Heimdall's own brand rather than the generic sage band.
	heimdall: {
		label: 'silver',
		bg: 'linear-gradient(180deg, rgba(229, 231, 235, 0.10), rgba(229, 231, 235, 0.02))',
		accent: '#e5e7eb'
	},
	// Thoth mode is gold (app.css .theme-thoth: --mode-primary #d4af37) — match it
	// so the chat wash reads as Thoth's own brand rather than the generic sky band.
	thoth: {
		label: 'gold',
		bg: 'linear-gradient(180deg, rgba(212, 175, 55, 0.12), rgba(212, 175, 55, 0.03))',
		accent: '#d4af37'
	}
};

/** Simple, stable string hash (djb2) → non-negative integer. */
function hashId(id: string): number {
	let hash = 5381;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 33) ^ id.charCodeAt(i);
	}
	return hash >>> 0;
}

/**
 * Return a stable, deterministic SessionColor for a given agent id.
 * Known agents use their pinned band; unknown ids hash into the palette.
 * The same id always yields the same color.
 */
export function colorForAgent(agentId: string): SessionColor {
	const normalized = (agentId ?? '').trim().toLowerCase();
	if (AGENT_THEME[normalized]) return AGENT_THEME[normalized];
	const band = AGENT_BANDS[normalized];
	if (band !== undefined) {
		return PALETTE[band];
	}
	return PALETTE[hashId(normalized) % PALETTE.length];
}

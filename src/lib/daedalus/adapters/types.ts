// DAEDALUS live-adapter contract.
//
// A SceneAdapter turns a real data source (config, API, DB query) into canonical
// VizData — the same shape a hand-authored scene produces. Downstream, an
// adapter-produced scene is indistinguishable from a static one (same renderer,
// drill-down, export). See ref/DAEDALUS.md → "## Adapters".

import type { VizData } from '../schema';

/** Context passed to an adapter's build() — multi-tenant scoping, etc. */
export interface AdapterContext {
	/** Site/tenant id, when the adapter is tenant-scoped. */
	siteId?: string;
}

/** A live data source that produces canonical VizData. */
export interface SceneAdapter {
	/** Stable id, referenced by SceneDoc.boundAdapter. */
	id: string;
	/** Human label for the adapter picker. */
	label: string;
	/** Short description of what it visualizes. */
	description: string;
	/** Pure-ish; client-safe. Produces canonical VizData. */
	build(ctx?: AdapterContext): VizData | Promise<VizData>;
}

// DAEDALUS adapter registry.
//
// Maps adapter ids → SceneAdapter implementations. A SceneDoc.boundAdapter value
// resolves to one of these. Wiring the viewer/store to resolve → build() → render
// is a later slice (see ref/DAEDALUS.md → "## Adapters").
//
// PxP MVP port: the 9realms-only live adapters (nav-tree, realms) were dropped on
// copy-in (they coupled to $lib/config/navigation + $lib/config/realms, which
// don't exist here). The registry ships empty — every PxP scene is static/authored
// for now. Re-add adapters here as PxP grows its own live data sources.

import type { SceneAdapter } from './types';

/** All registered live adapters. Empty in the PxP MVP port. */
export const ADAPTERS: SceneAdapter[] = [];

/** Resolve an adapter by id (e.g. from SceneDoc.boundAdapter). */
export function getAdapter(id: string): SceneAdapter | undefined {
	return ADAPTERS.find((a) => a.id === id);
}

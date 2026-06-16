// DAEDALUS scene-data resolution.
//
// One entry point the viewer/store calls to obtain the VizData to render for a
// scene. Static scenes return their authored data verbatim; live scenes (those
// with a registered `boundAdapter`) return adapter-produced data merged OVER the
// authored data so the adapter's families override the authored placeholders.
//
// Fails soft: an adapter throwing (or being unregistered) never blanks the
// canvas — the authored data is returned instead. See ref/DAEDALUS.md.

import type { SceneDoc, VizData } from '../schema';
import { getAdapter } from './registry';
import type { AdapterContext } from './types';

/** Authored data when static; adapter-produced (merged over authored) when bound. Fails soft. */
export async function resolveSceneData(scene: SceneDoc, ctx?: AdapterContext): Promise<VizData> {
	if (!scene.boundAdapter) return scene.data;
	const a = getAdapter(scene.boundAdapter);
	if (!a) return scene.data;
	try {
		const produced = await a.build(ctx);
		return { ...scene.data, ...produced }; // produced families override authored
	} catch {
		return scene.data; // never blank the canvas on adapter failure
	}
}

/** True when the scene is bound to a registered adapter (drives the LIVE badge + read-only). */
export function sceneIsLive(scene: SceneDoc): boolean {
	return !!scene.boundAdapter && !!getAdapter(scene.boundAdapter);
}

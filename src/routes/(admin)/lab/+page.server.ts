// /lab — scene tuning UI (admin-gated by the (admin) layout / hooks).
//
// Scans static/models/ for loadable 3D model files and hands the list to
// the page as web paths (e.g. '/models/foo.glb'). The folder may be empty
// or missing entirely — both return an empty list instead of erroring.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { PageServerLoad } from './$types';

const MODEL_EXTENSIONS = new Set(['.glb', '.gltf', '.obj', '.fbx']);

export const load: PageServerLoad = async () => {
	let models: string[] = [];

	try {
		const dir = path.resolve('static', 'models');
		const entries = await readdir(dir, { withFileTypes: true });
		models = entries
			.filter(
				(entry) =>
					entry.isFile() &&
					MODEL_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
			)
			.map((entry) => `/models/${entry.name}`)
			.sort();
	} catch {
		// static/models/ doesn't exist (or isn't readable) — the lab still
		// works with the procedural fallback, so just return no models.
		models = [];
	}

	return { models };
};

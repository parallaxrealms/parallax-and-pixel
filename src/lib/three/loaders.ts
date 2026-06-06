// src/lib/three/loaders.ts
//
// Format-agnostic model loading for the ModelScene engine.
// Loader is picked by file extension; each loader module is dynamically
// imported so the heavy examples/jsm code only ships when actually used.
// After load the object is wrapped, centered and normalized to a ~2-unit
// bounding sphere (radius 1) so ANY model drops into the scene at a
// predictable size — config.model.scale then multiplies on top.
//
// NOTE: this module statically imports `three`. That is safe because it is
// only ever reached via the dynamically-imported engine module (never from
// the top level of a .svelte file), so SSR never evaluates it.

import * as THREE from 'three';

/**
 * Load a model from a path under /static. Extension decides the loader:
 *   .glb / .gltf → GLTFLoader
 *   .obj         → OBJLoader
 *   .fbx         → FBXLoader
 *
 * Resolves with a wrapper Group whose origin sits at the model's bounding-
 * sphere center and whose scale normalizes the model to a 2-unit-diameter
 * bounding sphere.
 */
export async function loadModel(path: string): Promise<THREE.Object3D> {
	const ext = path.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? '';

	let object: THREE.Object3D;

	switch (ext) {
		case 'glb':
		case 'gltf': {
			const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
			const gltf = await new GLTFLoader().loadAsync(path);
			object = gltf.scene;
			break;
		}
		case 'obj': {
			const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
			object = await new OBJLoader().loadAsync(path);
			break;
		}
		case 'fbx': {
			const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
			object = await new FBXLoader().loadAsync(path);
			break;
		}
		default:
			throw new Error(`[loaders] Unsupported model extension ".${ext}" in "${path}"`);
	}

	return normalizeObject(object);
}

/**
 * Center + size-normalize a freshly loaded object.
 *
 * The raw object is parented to a wrapper Group:
 *   - the object is shifted so its bounding-sphere center sits at the
 *     wrapper's origin (rotation/spin pivots through the visual middle),
 *   - the wrapper is scaled so the bounding sphere has radius 1
 *     (a ~2-unit object), regardless of the source file's units
 *     (FBX cm-scale exports, meter-scale GLBs, etc.).
 */
function normalizeObject(object: THREE.Object3D): THREE.Object3D {
	object.updateMatrixWorld(true);

	const box = new THREE.Box3().setFromObject(object);
	const sphere = box.getBoundingSphere(new THREE.Sphere());
	const radius = Math.max(sphere.radius, 1e-4);

	const wrapper = new THREE.Group();
	wrapper.name = 'pnp-model-wrapper';
	wrapper.add(object);

	// Recenter inside the wrapper, then normalize the wrapper's scale.
	object.position.sub(sphere.center);
	wrapper.scale.setScalar(1 / radius);

	return wrapper;
}

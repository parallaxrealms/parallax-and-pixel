// src/lib/three/engine.ts
//
// The ModelScene engine — a config-driven three.js hero scene.
// Everything visible is described by one serializable SceneConfig (see
// ./types.ts, the frozen contract shared with the /lab tuning UI).
//
// createModelScene(canvas, config) builds the whole pipeline synchronously
// (renderer → lights → model group → pmndrs post chain) and returns a
// ModelSceneHandle. applyConfig(next) is cheap + idempotent: every frame-safe
// property is written directly; only a `model.path` change triggers an async
// reload (stale loads are cancelled via a token).
//
// NOTE: this module statically imports `three` and `postprocessing`. That is
// safe because it is only ever reached via dynamic import from
// ModelScene.svelte's onMount — SSR never evaluates it.

import * as THREE from 'three';
import {
	EffectComposer,
	RenderPass,
	EffectPass,
	BloomEffect,
	VignetteEffect,
	ChromaticAberrationEffect,
	NoiseEffect,
	BlendFunction,
	type Effect
} from 'postprocessing';
import type {
	SceneConfig,
	ModelSceneHandle,
	MaterialType,
	ToneMappingMode,
	DirectionalLightConfig,
	PrimitiveShape
} from './types';
import { cloneConfig } from './types';
import { loadModel } from './loaders';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TONE_MAPPING: Record<ToneMappingMode, THREE.ToneMapping> = {
	none: THREE.NoToneMapping,
	linear: THREE.LinearToneMapping,
	reinhard: THREE.ReinhardToneMapping,
	cineon: THREE.CineonToneMapping,
	aces: THREE.ACESFilmicToneMapping
};

/** Fresnel drift endpoints — P&P accent aqua → mint. */
const DRIFT_A = new THREE.Color('#00a5cf');
const DRIFT_B = new THREE.Color('#9fffcb');
/** Full aqua→mint→aqua drift cycle, seconds. */
const DRIFT_PERIOD = 18;

/** Material classes whose shaders accept the fresnel rim patch. */
const FRESNEL_TYPES = new Set([
	'MeshStandardMaterial',
	'MeshPhysicalMaterial',
	'MeshPhongMaterial',
	'MeshLambertMaterial'
]);

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function createModelScene(
	canvas: HTMLCanvasElement,
	config: SceneConfig
): ModelSceneHandle {
	let current = cloneConfig(config);
	let disposed = false;

	// ----- ready promise -----------------------------------------------------
	let readyResolve!: () => void;
	const ready = new Promise<void>((resolve) => {
		readyResolve = resolve;
	});
	let readySignaled = false;
	function signalReady() {
		if (readySignaled) return;
		readySignaled = true;
		// Defer one frame so the model/fallback has actually painted.
		requestAnimationFrame(() => readyResolve());
	}

	// ----- renderer / scene / camera -----------------------------------------
	function hostSize() {
		const host = canvas.parentElement;
		const w = host ? host.clientWidth : canvas.clientWidth;
		const h = host ? host.clientHeight : canvas.clientHeight;
		return { w: Math.max(1, w), h: Math.max(1, h) };
	}
	const { w: w0, h: h0 } = hostSize();

	// Always construct with alpha:true so renderer.transparent can be toggled
	// live via clearAlpha (an alpha:false context can never become transparent).
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		alpha: true,
		powerPreference: 'high-performance',
		stencil: false
	});
	renderer.setSize(w0, h0, false);

	const scene = new THREE.Scene();

	const camera = new THREE.PerspectiveCamera(current.camera.fov, w0 / h0, 0.1, 200);
	camera.position.set(current.camera.x, current.camera.y, current.camera.z);
	camera.lookAt(0, current.camera.targetY, 0);

	function clampPixelRatio(requested: number): number {
		const device = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
		return Math.max(0.5, Math.min(requested, device * 1.5, 3));
	}

	// ----- lights -------------------------------------------------------------
	const keyLight = new THREE.DirectionalLight();
	const rimLight = new THREE.DirectionalLight();
	const fillLight = new THREE.DirectionalLight();
	const ambientLight = new THREE.AmbientLight();
	scene.add(keyLight, rimLight, fillLight, ambientLight);

	function syncDirLight(light: THREE.DirectionalLight, cfg: DirectionalLightConfig) {
		light.visible = cfg.on;
		light.intensity = cfg.intensity;
		light.color.set(cfg.color);
		light.position.set(cfg.x, cfg.y, cfg.z);
	}
	function syncLights() {
		const l = current.lights;
		syncDirLight(keyLight, l.key);
		syncDirLight(rimLight, l.rim);
		syncDirLight(fillLight, l.fill);
		ambientLight.visible = l.ambient.on;
		ambientLight.intensity = l.ambient.intensity;
		ambientLight.color.set(l.ambient.color);
	}

	// ----- fresnel rim (shared uniforms, patched via onBeforeCompile) ---------
	// The uniform OBJECTS are shared by reference across every patched material,
	// so applyConfig / the drift loop update all of them at once without
	// recompiles. Toggling fresnel.on simply zeroes uRimStrength — no rebuild.
	const rimUniforms = {
		uRimColor: { value: new THREE.Color(current.fresnel.color) },
		uRimPower: { value: current.fresnel.power },
		uRimStrength: { value: current.fresnel.on ? current.fresnel.strength : 0 }
	};

	function patchFresnel(mat: THREE.Material) {
		// Standard/physical/phong/lambert all share the chunk layout we splice
		// into. Basic/normal/toon don't — skip silently per the contract.
		if (!FRESNEL_TYPES.has(mat.type)) return;
		if (mat.userData.pnpFresnel) return;
		mat.userData.pnpFresnel = true;
		mat.onBeforeCompile = (shader) => {
			shader.uniforms.uRimColor = rimUniforms.uRimColor;
			shader.uniforms.uRimPower = rimUniforms.uRimPower;
			shader.uniforms.uRimStrength = rimUniforms.uRimStrength;
			shader.vertexShader = shader.vertexShader
				.replace(
					'#include <common>',
					`#include <common>
					varying vec3 vPnpViewNormal;
					varying vec3 vPnpViewPos;`
				)
				.replace(
					'#include <fog_vertex>',
					`#include <fog_vertex>
					vPnpViewNormal = normalize(normalMatrix * normal);
					vPnpViewPos = -mvPosition.xyz;`
				);
			shader.fragmentShader = shader.fragmentShader
				.replace(
					'#include <common>',
					`#include <common>
					uniform vec3 uRimColor;
					uniform float uRimPower;
					uniform float uRimStrength;
					varying vec3 vPnpViewNormal;
					varying vec3 vPnpViewPos;`
				)
				.replace(
					'#include <dithering_fragment>',
					`#include <dithering_fragment>
					vec3 pnpV = normalize(vPnpViewPos);
					vec3 pnpN = normalize(vPnpViewNormal);
					float pnpFres = pow(1.0 - max(dot(pnpN, pnpV), 0.0), uRimPower);
					gl_FragColor.rgb += uRimColor * pnpFres * uRimStrength;`
				);
		};
		mat.needsUpdate = true;
	}

	function syncFresnel() {
		const f = current.fresnel;
		rimUniforms.uRimPower.value = f.power;
		rimUniforms.uRimStrength.value = f.on ? f.strength : 0;
		// While drifting, the render loop owns uRimColor.
		if (!f.drift) rimUniforms.uRimColor.value.set(f.color);
	}

	// ----- model group + procedural fallback ----------------------------------
	// modelGroup carries the config transform (position/rotation/spin/float/
	// scale) every frame; whatever is inside it (loaded model OR fallback)
	// inherits the motion for free.
	const modelGroup = new THREE.Group();
	scene.add(modelGroup);

	let currentModelRoot: THREE.Object3D | null = null;
	let fallbackRoot: THREE.Group | null = null;

	function makeShapeGeometry(shape: PrimitiveShape): THREE.BufferGeometry {
		switch (shape) {
			case 'cube':
				return new THREE.BoxGeometry(1.4, 1.4, 1.4);
			case 'sphere':
				return new THREE.SphereGeometry(1, 32, 16);
			case 'torus':
				return new THREE.TorusGeometry(0.85, 0.35, 16, 48);
			case 'torusKnot':
				return new THREE.TorusKnotGeometry(0.7, 0.25, 96, 16);
			case 'cone':
				return new THREE.ConeGeometry(1, 1.6, 24);
			case 'icosahedron':
			default:
				return new THREE.IcosahedronGeometry(1, 1);
		}
	}

	function createFallback(): THREE.Group {
		// Intentional-looking primitive (config.model.shape): faceted dark-slate
		// core with aqua emissive + the P&P fresnel rim. The additive wireframe
		// shell around it is NOT built here — it's the config-driven shell
		// system below (config.model.wireframeShell), shared with loaded models.
		const shape = current.model.shape ?? 'icosahedron';
		const group = new THREE.Group();
		group.name = 'pnp-fallback';

		const coreMat = new THREE.MeshStandardMaterial({
			color: new THREE.Color('#0b1220'),
			metalness: 0.55,
			roughness: 0.35,
			emissive: new THREE.Color('#00a5cf'),
			emissiveIntensity: 0.22,
			flatShading: true
		});
		patchFresnel(coreMat);
		const core = new THREE.Mesh(makeShapeGeometry(shape), coreMat);
		core.userData.pnpOriginalMaterial = coreMat;

		group.add(core);
		return group;
	}

	function showFallback() {
		if (!fallbackRoot) fallbackRoot = createFallback();
		if (!fallbackRoot.parent) modelGroup.add(fallbackRoot);
	}
	function hideFallback() {
		if (fallbackRoot?.parent) modelGroup.remove(fallbackRoot);
	}

	/** Rebuild the fallback when config.model.shape changes. */
	function rebuildFallback() {
		if (!fallbackRoot) return; // not built yet — next showFallback uses the new shape
		const wasVisible = !!fallbackRoot.parent;
		if (wasVisible) modelGroup.remove(fallbackRoot);
		disposeObjectTree(fallbackRoot, overrideMat);
		fallbackRoot = null;
		if (wasVisible) {
			showFallback();
			syncMaterials(true);
		}
	}

	// ----- wireframe shell (config.model.wireframeShell) -----------------------
	// One additive wireframe duplicate wrapped around whatever is on screen —
	// a deep clone of the loaded model, or a fresh primitive matching the
	// fallback shape. Lives INSIDE modelGroup so it inherits the model
	// transform; its own (relative) transform is applied per frame.
	//
	// Disposal rules:
	//   - model-clone shells SHARE geometries with the live model → never
	//     dispose their geometries (shellOwnsGeometry = false);
	//   - primitive shells own their geometry → dispose it on teardown;
	//   - shellMat is shared/reused across rebuilds and only disposed with
	//     the engine.
	const shellMat = new THREE.MeshBasicMaterial({
		wireframe: true,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	let shellRoot: THREE.Group | null = null;
	let shellOwnsGeometry = false;
	/** Model root the shell was cloned from (null when primitive-sourced). */
	let shellSourceModel: THREE.Object3D | null = null;
	/** Shape the shell was built from (null when model-sourced). */
	let shellSourceShape: PrimitiveShape | null = null;
	let shellSpinAngle = 0;

	function teardownShell() {
		if (!shellRoot) return;
		modelGroup.remove(shellRoot);
		if (shellOwnsGeometry) {
			// Primitive shells own their geometry.
			shellRoot.traverse((obj) => {
				const mesh = obj as THREE.Mesh;
				if (mesh.isMesh) mesh.geometry?.dispose();
			});
		}
		// Model-clone shells share geometries with the live model — leave them
		// alone. shellMat is shared and survives for cheap re-enable.
		shellRoot = null;
		shellOwnsGeometry = false;
		shellSourceModel = null;
		shellSourceShape = null;
	}

	function buildShell() {
		teardownShell();
		const ws = current.model.wireframeShell;
		if (!ws?.on) return;

		const group = new THREE.Group();
		group.name = 'pnp-wireframe-shell';
		group.userData.pnpDecoration = true;

		if (currentModelRoot) {
			// Deep clone: geometries are SHARED with the live model, materials
			// are all swapped for the one shared shell material.
			const clone = currentModelRoot.clone(true);
			clone.traverse((obj) => {
				obj.userData.pnpDecoration = true;
				const mesh = obj as THREE.Mesh;
				if (mesh.isMesh) {
					mesh.material = shellMat;
					delete mesh.userData.pnpOriginalMaterial;
				}
			});
			group.add(clone);
			shellOwnsGeometry = false;
			shellSourceModel = currentModelRoot;
			shellSourceShape = null;
		} else {
			const shape = current.model.shape ?? 'icosahedron';
			const mesh = new THREE.Mesh(makeShapeGeometry(shape), shellMat);
			mesh.userData.pnpDecoration = true;
			group.add(mesh);
			shellOwnsGeometry = true;
			shellSourceModel = null;
			shellSourceShape = shape;
		}

		// Pose immediately so the first painted frame is already correct.
		group.position.set(ws.x, ws.y, ws.z);
		group.rotation.set(ws.rotationX, ws.rotationY + shellSpinAngle, ws.rotationZ);
		group.scale.setScalar(ws.scale);
		modelGroup.add(group);
		shellRoot = group;
	}

	/**
	 * Cheap idempotent sync (called from applyConfig and after model/fallback
	 * swaps). Color/opacity mutate the shared material in place; the shell is
	 * rebuilt only when it's missing or its source no longer matches what's
	 * on screen. Missing `wireframeShell` config counts as off.
	 */
	function syncShell() {
		const ws = current.model.wireframeShell;
		if (!ws?.on) {
			teardownShell();
			return;
		}
		shellMat.color.set(ws.color);
		shellMat.opacity = ws.opacity;
		const sourceMatches =
			shellRoot &&
			shellSourceModel === currentModelRoot &&
			(currentModelRoot !== null || shellSourceShape === (current.model.shape ?? 'icosahedron'));
		if (!sourceMatches) buildShell();
	}

	// ----- material handling ---------------------------------------------------
	let overrideMat: THREE.Material | null = null;
	let overrideType: MaterialType | null = null;
	let overrideAssigned = false;
	let toonGradient: THREE.Texture | null = null;

	function getToonGradient(): THREE.Texture {
		if (toonGradient) return toonGradient;
		const c = document.createElement('canvas');
		c.width = 3;
		c.height = 1;
		const ctx = c.getContext('2d')!;
		const img = ctx.createImageData(3, 1);
		img.data.set([60, 60, 60, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
		ctx.putImageData(img, 0, 0);
		const tex = new THREE.CanvasTexture(c);
		tex.magFilter = THREE.NearestFilter;
		tex.minFilter = THREE.NearestFilter;
		tex.generateMipmaps = false;
		toonGradient = tex;
		return tex;
	}

	function buildOverrideMaterial(type: MaterialType): THREE.Material {
		let mat: THREE.Material;
		switch (type) {
			case 'physical':
				mat = new THREE.MeshPhysicalMaterial();
				break;
			case 'basic':
				mat = new THREE.MeshBasicMaterial();
				break;
			case 'lambert':
				mat = new THREE.MeshLambertMaterial();
				break;
			case 'phong':
				mat = new THREE.MeshPhongMaterial();
				break;
			case 'normal':
				mat = new THREE.MeshNormalMaterial();
				break;
			case 'toon':
				mat = new THREE.MeshToonMaterial({ gradientMap: getToonGradient() });
				break;
			case 'standard':
			default:
				mat = new THREE.MeshStandardMaterial();
				break;
		}
		patchFresnel(mat); // silently no-ops for unsupported types
		return mat;
	}

	/** Write the material config onto a material, guarding per-type props. */
	function tuneMaterial(mat: THREE.Material, m: SceneConfig['material']) {
		const anyMat = mat as THREE.Material & {
			color?: THREE.Color;
			metalness?: number;
			roughness?: number;
			emissive?: THREE.Color;
			emissiveIntensity?: number;
			wireframe?: boolean;
			flatShading?: boolean;
		};
		if (anyMat.color) anyMat.color.set(m.baseColor);
		if ('metalness' in mat) anyMat.metalness = m.metalness;
		if ('roughness' in mat) anyMat.roughness = m.roughness;
		mat.opacity = m.opacity;
		mat.transparent = m.opacity < 1;
		if (anyMat.emissive) {
			anyMat.emissive.set(m.emissiveColor);
			anyMat.emissiveIntensity = m.emissiveIntensity;
		}
		if ('wireframe' in mat) anyMat.wireframe = m.wireframe;
		if ('flatShading' in mat && anyMat.flatShading !== m.flatShading) {
			anyMat.flatShading = m.flatShading;
			mat.needsUpdate = true; // flat shading is compiled into the program
		}
	}

	/** Iterate every overridable mesh currently in the scene (no decorations). */
	function forEachMesh(cb: (mesh: THREE.Mesh) => void) {
		modelGroup.traverse((obj) => {
			const mesh = obj as THREE.Mesh;
			if (!mesh.isMesh || mesh.userData.pnpDecoration) return;
			cb(mesh);
		});
	}

	/**
	 * Reconcile materials with the current config.
	 * @param rebind force re-assignment to meshes (used after a model swap,
	 *               when freshly attached meshes still carry their originals).
	 */
	function syncMaterials(rebind = false) {
		const m = current.material;
		if (m.override) {
			if (!overrideMat || overrideType !== m.type) {
				overrideMat?.dispose();
				overrideMat = buildOverrideMaterial(m.type);
				overrideType = m.type;
				rebind = true;
			}
			tuneMaterial(overrideMat, m);
			if (rebind || !overrideAssigned) {
				forEachMesh((mesh) => {
					mesh.material = overrideMat!;
				});
				overrideAssigned = true;
			}
		} else {
			if (overrideAssigned) {
				forEachMesh((mesh) => {
					const orig = mesh.userData.pnpOriginalMaterial as
						| THREE.Material
						| THREE.Material[]
						| undefined;
					if (orig) mesh.material = orig;
				});
				overrideAssigned = false;
			}
			// Imported materials stay theirs, but fresnel + emissive knobs still
			// apply where the material supports them.
			forEachMesh((mesh) => {
				const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
				for (const mat of mats) {
					if (!mat) continue;
					patchFresnel(mat);
					const anyMat = mat as THREE.Material & {
						emissive?: THREE.Color;
						emissiveIntensity?: number;
					};
					if (anyMat.emissive) {
						anyMat.emissive.set(m.emissiveColor);
						anyMat.emissiveIntensity = m.emissiveIntensity;
					}
				}
			});
		}
	}

	// ----- model loading --------------------------------------------------------
	// Monotonic token cancels stale async loads: each setModelPath bumps it and
	// every continuation checks it still owns the latest request.
	let loadToken = 0;

	function disposeMaterialDeep(mat: THREE.Material) {
		const rec = mat as unknown as Record<string, unknown>;
		for (const key of Object.keys(rec)) {
			const val = rec[key] as THREE.Texture | null;
			if (val && typeof val === 'object' && (val as THREE.Texture).isTexture) {
				val.dispose();
			}
		}
		mat.dispose();
	}

	function disposeObjectTree(root: THREE.Object3D, skip: THREE.Material | null) {
		const mats = new Set<THREE.Material>();
		root.traverse((obj) => {
			const mesh = obj as THREE.Mesh;
			if (!mesh.isMesh) return;
			mesh.geometry?.dispose();
			const collect = (m: THREE.Material | THREE.Material[] | undefined) => {
				if (!m) return;
				for (const x of Array.isArray(m) ? m : [m]) mats.add(x);
			};
			collect(mesh.material);
			collect(mesh.userData.pnpOriginalMaterial as THREE.Material | undefined);
		});
		for (const mat of mats) {
			// The shared override material survives model swaps.
			if (mat === skip) continue;
			disposeMaterialDeep(mat);
		}
	}

	function removeCurrentModel() {
		if (!currentModelRoot) return;
		// A model-clone shell shares this model's geometries — detach it BEFORE
		// the dispose pass below frees them out from under it.
		if (shellSourceModel === currentModelRoot) teardownShell();
		modelGroup.remove(currentModelRoot);
		disposeObjectTree(currentModelRoot, overrideMat);
		currentModelRoot = null;
	}

	function setModelPath(path: string | null) {
		const token = ++loadToken;

		// Per contract: while loading (or with no path at all) the procedural
		// fallback is on screen — the old model never lingers half-stale.
		removeCurrentModel();
		showFallback();
		syncMaterials(true);
		syncShell();

		if (path === null) {
			signalReady();
			return;
		}

		loadModel(path)
			.then((obj) => {
				if (token !== loadToken || disposed) {
					// A newer request superseded this load — drop it on the floor.
					disposeObjectTree(obj, null);
					return;
				}
				obj.traverse((o) => {
					const mesh = o as THREE.Mesh;
					if (mesh.isMesh) {
						mesh.userData.pnpOriginalMaterial = mesh.material;
						mesh.frustumCulled = false;
					}
				});
				hideFallback();
				modelGroup.add(obj);
				currentModelRoot = obj;
				syncMaterials(true);
				syncShell(); // primitive-sourced shell no longer matches → model clone
			})
			.catch((err) => {
				if (token === loadToken && !disposed) {
					console.warn(`[ModelScene] Failed to load "${path}" — keeping fallback.`, err);
				}
			})
			.finally(() => {
				// Resolve ready even on failure: the fallback is on screen.
				if (token === loadToken) signalReady();
			});
	}

	// ----- post-processing (pmndrs) ----------------------------------------------
	const composer = new EffectComposer(renderer, {
		frameBufferType: THREE.HalfFloatType,
		multisampling: renderer.capabilities.isWebGL2 ? 4 : 0
	});
	composer.addPass(new RenderPass(scene, camera));

	let effectPass: EffectPass | null = null;
	let effectKey = '__init__';
	let bloomFx: BloomEffect | null = null;
	let vignetteFx: VignetteEffect | null = null;
	let caFx: ChromaticAberrationEffect | null = null;
	let noiseFx: NoiseEffect | null = null;

	function syncPost() {
		const p = current.post;
		// Rebuild the EffectPass ONLY when the enabled set changes (EffectPass
		// compiles one merged shader per effect combination); otherwise mutate
		// the live effect parameters in place.
		const key = `${p.bloom.on}|${p.vignette.on}|${p.chromaticAberration.on}|${p.noise.on}`;
		if (key !== effectKey) {
			effectKey = key;
			if (effectPass) {
				composer.removePass(effectPass);
				effectPass.dispose(); // also disposes the effects it owns
				effectPass = null;
			}
			bloomFx = null;
			vignetteFx = null;
			caFx = null;
			noiseFx = null;

			const effects: Effect[] = [];
			if (p.bloom.on) {
				bloomFx = new BloomEffect({
					mipmapBlur: true,
					intensity: p.bloom.strength,
					radius: p.bloom.radius,
					luminanceThreshold: p.bloom.threshold,
					luminanceSmoothing: 0.2
				});
				effects.push(bloomFx);
			}
			if (p.chromaticAberration.on) {
				caFx = new ChromaticAberrationEffect({
					offset: new THREE.Vector2(p.chromaticAberration.offset, p.chromaticAberration.offset),
					radialModulation: false,
					modulationOffset: 0.15
				});
				effects.push(caFx);
			}
			if (p.noise.on) {
				noiseFx = new NoiseEffect({
					blendFunction: BlendFunction.OVERLAY,
					premultiply: true
				});
				effects.push(noiseFx);
			}
			if (p.vignette.on) {
				vignetteFx = new VignetteEffect({
					offset: p.vignette.offset,
					darkness: p.vignette.darkness
				});
				effects.push(vignetteFx);
			}
			if (effects.length > 0) {
				effectPass = new EffectPass(camera, ...effects);
				composer.addPass(effectPass);
			}
		}

		// In-place parameter writes — cheap, no shader rebuilds.
		if (bloomFx) {
			bloomFx.intensity = p.bloom.strength;
			bloomFx.luminanceMaterial.threshold = p.bloom.threshold;
			bloomFx.mipmapBlurPass.radius = p.bloom.radius;
		}
		if (caFx) {
			caFx.offset.set(p.chromaticAberration.offset, p.chromaticAberration.offset);
		}
		if (noiseFx) {
			noiseFx.blendMode.opacity.value = p.noise.opacity;
		}
		if (vignetteFx) {
			vignetteFx.offset = p.vignette.offset;
			vignetteFx.darkness = p.vignette.darkness;
		}
	}

	// ----- renderer config --------------------------------------------------------
	const clearColor = new THREE.Color();
	function syncRenderer() {
		const r = current.renderer;
		renderer.toneMapping = TONE_MAPPING[r.toneMapping] ?? THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = r.exposure;
		clearColor.set(r.clearColor);
		renderer.setClearColor(clearColor, r.transparent ? 0 : 1);
		const pr = clampPixelRatio(r.pixelRatio);
		if (renderer.getPixelRatio() !== pr) {
			renderer.setPixelRatio(pr);
			resize();
		}
	}

	// ----- camera config -----------------------------------------------------------
	function syncCamera() {
		const c = current.camera;
		if (camera.fov !== c.fov) {
			camera.fov = c.fov;
			camera.updateProjectionMatrix();
		}
		// Position/lookAt are owned by the render loop (parallax blends in).
	}

	// ----- resize --------------------------------------------------------------------
	function resize() {
		if (disposed) return;
		const { w, h } = hostSize();
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		// composer.setSize also resizes the renderer + all internal buffers.
		composer.setSize(w, h, false);
	}
	let ro: ResizeObserver | null = null;
	if (typeof ResizeObserver !== 'undefined') {
		ro = new ResizeObserver(resize);
		ro.observe(canvas.parentElement ?? canvas);
	}

	// ----- mouse parallax ---------------------------------------------------------------
	let mouseX = 0;
	let mouseY = 0;
	let parX = 0;
	let parY = 0;
	function onPointerMove(ev: PointerEvent) {
		mouseX = (ev.clientX / window.innerWidth) * 2 - 1;
		mouseY = -((ev.clientY / window.innerHeight) * 2 - 1);
	}
	window.addEventListener('pointermove', onPointerMove);

	// ----- visibility pause ----------------------------------------------------------------
	let paused = false;
	function onVisibility() {
		const hidden = document.hidden;
		if (hidden === paused) return;
		paused = hidden;
		if (paused) {
			// Cancel the queued rAF so resume doesn't spawn a second loop.
			cancelAnimationFrame(rafId);
		} else if (!disposed) {
			clock.getDelta(); // swallow the hidden-time delta
			frame();
		}
	}
	document.addEventListener('visibilitychange', onVisibility);

	// ----- render loop ------------------------------------------------------------------------
	const clock = new THREE.Clock();
	let rafId = 0;
	let elapsed = 0;
	let spinAngle = 0;

	function frame() {
		if (disposed || paused) return;
		rafId = requestAnimationFrame(frame);
		const dt = Math.min(clock.getDelta(), 0.1);
		elapsed += dt;

		// Model transform: config pose + continuous spin + float bob.
		const m = current.model;
		spinAngle = (spinAngle + m.spinSpeed * dt) % (Math.PI * 2);
		const float = m.floatAmplitude !== 0 ? Math.sin(elapsed * m.floatSpeed) * m.floatAmplitude : 0;
		modelGroup.position.set(m.x, m.y + float, m.z);
		modelGroup.rotation.set(m.rotationX, m.rotationY + spinAngle, m.rotationZ);
		modelGroup.scale.setScalar(m.scale);

		// Wireframe shell: its own (relative) pose + spin + float on top of the
		// inherited model transform. Spin accumulates like the model's so live
		// spinSpeed edits never jump.
		const ws = m.wireframeShell;
		if (shellRoot && ws?.on) {
			shellSpinAngle = (shellSpinAngle + ws.spinSpeed * dt) % (Math.PI * 2);
			const shellFloat =
				ws.floatAmplitude !== 0 ? Math.sin(elapsed * ws.floatSpeed) * ws.floatAmplitude : 0;
			shellRoot.position.set(ws.x, ws.y + shellFloat, ws.z);
			shellRoot.rotation.set(ws.rotationX, ws.rotationY + shellSpinAngle, ws.rotationZ);
			shellRoot.scale.setScalar(ws.scale);
		}

		// Fresnel drift: slow aqua → mint → aqua sweep.
		const f = current.fresnel;
		if (f.on && f.drift) {
			const t = 0.5 - 0.5 * Math.cos((elapsed / DRIFT_PERIOD) * Math.PI * 2);
			rimUniforms.uRimColor.value.copy(DRIFT_A).lerp(DRIFT_B, t);
		}

		// Camera: config pose + eased mouse parallax.
		const c = current.camera;
		const p = c.parallax;
		const targetX = p.on ? mouseX * p.amount : 0;
		const targetY = p.on ? mouseY * p.amount * 0.6 : 0;
		const ease = Math.min(Math.max(p.ease, 0.001), 1);
		parX += (targetX - parX) * ease;
		parY += (targetY - parY) * ease;
		camera.position.set(c.x + parX, c.y + parY, c.z);
		camera.lookAt(0, c.targetY, 0);

		composer.render(dt);
	}

	// ----- applyConfig --------------------------------------------------------------------------
	function applyConfig(next: SceneConfig): void {
		if (disposed) return;
		const prevPath = current.model.path;
		const prevShape = current.model.shape ?? 'icosahedron';
		current = cloneConfig(next);

		syncRenderer();
		syncLights();
		syncCamera();
		syncFresnel();
		syncMaterials();
		syncPost();

		// Shape change rebuilds the (cheap) procedural fallback.
		if ((current.model.shape ?? 'icosahedron') !== prevShape) {
			rebuildFallback();
		}

		// Shell: color/opacity in place; rebuilds only on on-flip/source change.
		syncShell();

		// Only a path change costs anything real — async reload behind a token.
		if (current.model.path !== prevPath) {
			setModelPath(current.model.path);
		}
	}

	// ----- dispose --------------------------------------------------------------------------------
	function dispose() {
		if (disposed) return;
		disposed = true;
		loadToken++; // cancels any in-flight load

		cancelAnimationFrame(rafId);
		window.removeEventListener('pointermove', onPointerMove);
		document.removeEventListener('visibilitychange', onVisibility);
		ro?.disconnect();

		teardownShell();
		shellMat.dispose();
		removeCurrentModel();
		if (fallbackRoot) {
			modelGroup.remove(fallbackRoot);
			disposeObjectTree(fallbackRoot, overrideMat);
			fallbackRoot = null;
		}
		overrideMat?.dispose();
		overrideMat = null;
		toonGradient?.dispose();
		toonGradient = null;

		composer.dispose(); // disposes all passes (incl. effects) + buffers
		renderer.dispose();

		// Never leave a caller awaiting a ready that can't arrive.
		if (!readySignaled) {
			readySignaled = true;
			readyResolve();
		}
	}

	// ----- boot ------------------------------------------------------------------------------------
	syncRenderer();
	syncLights();
	syncCamera();
	syncFresnel();
	syncPost();
	setModelPath(current.model.path);
	frame();

	return { applyConfig, ready, dispose };
}

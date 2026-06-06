// src/lib/three/types.ts
//
// FROZEN CONTRACT between the ModelScene engine and the /lab tuning UI.
// The entire scene is described by one serializable SceneConfig object.
// The lab edits a SceneConfig with knobs; "Copy as code" dumps it as a
// paste-ready snippet for heroConfig.ts. The engine exposes a single
// applyConfig(config) that cheaply re-applies every frame-safe property
// and reloads the model only when `model.path` changes.

export type MaterialType =
	| 'standard'
	| 'physical'
	| 'basic'
	| 'lambert'
	| 'phong'
	| 'normal'
	| 'toon';

export type ToneMappingMode = 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces';

export interface DirectionalLightConfig {
	on: boolean;
	intensity: number;
	color: string; // hex '#rrggbb'
	x: number;
	y: number;
	z: number;
}

export interface SceneConfig {
	model: {
		/**
		 * Path under /static, e.g. '/models/buddha.glb'. Format is inferred
		 * from the extension: .glb/.gltf → GLTFLoader, .obj → OBJLoader,
		 * .fbx → FBXLoader. `null` renders the built-in procedural fallback
		 * (wireframe-ish icosahedron) so the scene never breaks.
		 */
		path: string | null;
		scale: number;
		x: number;
		y: number;
		z: number;
		rotationX: number; // radians
		rotationY: number;
		rotationZ: number;
		/** Continuous Y-axis spin in radians/second. 0 = static. */
		spinSpeed: number;
		/** Gentle vertical bob amplitude in world units. 0 = off. */
		floatAmplitude: number;
		floatSpeed: number;
	};

	lights: {
		key: DirectionalLightConfig;
		rim: DirectionalLightConfig;
		fill: DirectionalLightConfig;
		ambient: { on: boolean; intensity: number; color: string };
	};

	material: {
		/**
		 * false = keep the model's own imported materials untouched
		 * (fresnel/emissive knobs still apply where possible).
		 * true = replace all mesh materials with one built from the
		 * settings below.
		 */
		override: boolean;
		type: MaterialType;
		baseColor: string;
		metalness: number;
		roughness: number;
		opacity: number;
		emissiveColor: string;
		emissiveIntensity: number;
		wireframe: boolean;
		flatShading: boolean;
	};

	fresnel: {
		on: boolean;
		color: string;
		power: number;
		strength: number;
		/** Auto color sweep between accent aqua and mint over time. */
		drift: boolean;
	};

	post: {
		bloom: { on: boolean; strength: number; radius: number; threshold: number };
		vignette: { on: boolean; offset: number; darkness: number };
		chromaticAberration: { on: boolean; offset: number };
		noise: { on: boolean; opacity: number };
	};

	camera: {
		fov: number;
		x: number;
		y: number;
		z: number;
		targetY: number;
		/** Mouse-follow parallax drift of the camera. amount = world units. */
		parallax: { on: boolean; amount: number; ease: number };
	};

	renderer: {
		pixelRatio: number; // supersampling knob; clamped to device max 3
		toneMapping: ToneMappingMode;
		exposure: number;
		/** Transparent canvas (composite over page bg) vs solid clear color. */
		transparent: boolean;
		clearColor: string;
	};
}

/** Imperative handle the ModelScene component hands back via onHandle. */
export interface ModelSceneHandle {
	/**
	 * Idempotent + cheap: call on every knob change. Reloads the model
	 * asynchronously only if `model.path` changed since the last apply.
	 */
	applyConfig(config: SceneConfig): void;
	/** Resolves when the current model (or fallback) is loaded and painted. */
	ready: Promise<void>;
	dispose(): void;
}

/** Props for ModelScene.svelte */
export interface ModelSceneProps {
	config: SceneConfig;
	/** Fires once the model/fallback is on screen (also on load failure). */
	onReady?: () => void;
	onHandle?: (handle: ModelSceneHandle) => void;
	class?: string;
}

/**
 * Default hero scene — Parallax & Pixel palette
 * (aqua #00a5cf, sea green #25a18e, mint #9fffcb on near-black slate).
 */
export const DEFAULT_SCENE_CONFIG: SceneConfig = {
	model: {
		path: null,
		scale: 1,
		x: 0,
		y: 0,
		z: 0,
		rotationX: 0,
		rotationY: 0,
		rotationZ: 0,
		spinSpeed: 0.15,
		floatAmplitude: 0.08,
		floatSpeed: 0.6
	},
	lights: {
		key: { on: true, intensity: 1.1, color: '#00a5cf', x: -8, y: 6, z: 6 },
		rim: { on: true, intensity: 1.4, color: '#9fffcb', x: 4, y: 2, z: -6 },
		fill: { on: false, intensity: 0.3, color: '#25a18e', x: 6, y: -2, z: 4 },
		ambient: { on: true, intensity: 0.12, color: '#0f172a' }
	},
	material: {
		override: false,
		type: 'standard',
		baseColor: '#0b1220',
		metalness: 0.4,
		roughness: 0.6,
		opacity: 1,
		emissiveColor: '#00a5cf',
		emissiveIntensity: 0.2,
		wireframe: false,
		flatShading: false
	},
	fresnel: {
		on: true,
		color: '#00a5cf',
		power: 6,
		strength: 0.8,
		drift: true
	},
	post: {
		bloom: { on: true, strength: 0.9, radius: 0.7, threshold: 0.35 },
		vignette: { on: true, offset: 0.25, darkness: 0.65 },
		chromaticAberration: { on: false, offset: 0.0015 },
		noise: { on: false, opacity: 0.05 }
	},
	camera: {
		fov: 38,
		x: 0,
		y: 1,
		z: 8,
		targetY: 0.8,
		parallax: { on: true, amount: 0.35, ease: 0.05 }
	},
	renderer: {
		pixelRatio: 1.5,
		toneMapping: 'aces',
		exposure: 1,
		transparent: true,
		clearColor: '#020617'
	}
};

/** Deep-clone helper so lab presets / knob state never share references. */
export function cloneConfig(config: SceneConfig): SceneConfig {
	return JSON.parse(JSON.stringify(config));
}

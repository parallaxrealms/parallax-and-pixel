// src/lib/three/heroConfig.ts
//
// Live config for the homepage hero's ModelScene.
// Paste output of /lab "Copy as code" here to update the live hero.

import { DEFAULT_SCENE_CONFIG, cloneConfig, type SceneConfig } from './types';

export const HERO_SCENE_CONFIG: SceneConfig = cloneConfig(DEFAULT_SCENE_CONFIG);

// Tasteful tweaks on top of the defaults — keep the hero composition airy:
// the model sits slightly high-center (text columns live in the lower half),
// with a touch of fill so the dark side doesn't fall to pure black.
HERO_SCENE_CONFIG.model.y = 0.8;
HERO_SCENE_CONFIG.lights.fill.on = true;
HERO_SCENE_CONFIG.post.noise.on = true;
HERO_SCENE_CONFIG.post.noise.opacity = 0.04;

<script lang="ts">
	/**
	 * StackScene — the 3D Stack primitive. Renders an ordered set of VizLayers as
	 * a vertical stack of clickable cylinders (the "full-stack" diagram). Click a
	 * layer → camera tweens to frame it + emits onSelect(id). Labels are projected
	 * HTML overlays (crisp + export-friendly), not in-canvas text.
	 *
	 * Lifecycle/dispose patterns follow YggdrasilScene / CyberBuddhaScene:
	 * onMount init + cleanup, dispose every geometry/material/renderer on destroy,
	 * MSAA via antialias, DPR cap, prefers-reduced-motion.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import type { VizLayer, LabelStyle, LabelAnchor, SceneEnvironment } from '../schema';

	interface Props {
		layers: VizLayer[];
		selectedId: string | null;
		onSelect: (id: string | null) => void;
		defaultLabelStyle?: LabelStyle;
		environment?: SceneEnvironment;
	}
	let { layers, selectedId, onSelect, defaultLabelStyle, environment }: Props = $props();

	let container: HTMLDivElement | null = $state(null);
	let canvas: HTMLCanvasElement | null = $state(null);

	// Projected screen positions for the HTML band labels, recomputed each frame.
	type LabelPos = {
		id: string;
		label: string;
		sublabel?: string;
		x: number;
		y: number;
		visible: boolean;
		selected: boolean;
		scale: number;
		color?: string;
		anchor: LabelAnchor;
	};
	let labelPositions = $state<LabelPos[]>([]);

	// Mutable mirror the render loop reads (props can't be closed over cleanly).
	let selectedMirror = $state<string | null>(null);
	$effect(() => {
		selectedMirror = selectedId;
	});

	// Composite PNG capture (3D canvas + projected band labels drawn on, so the
	// labels — which are HTML overlays, not in the canvas — survive the export).
	// Assigned in onMount where the renderer/scene/camera live.
	let doCapture: (() => string | null) | null = null;
	export function capturePng(): string | null {
		return doCapture ? doCapture() : null;
	}

	const LAYER_H = 0.6;
	const GAP = 0.05;
	const SP = LAYER_H + GAP;
	const RADIUS = 2.3;

	onMount(() => {
		if (!browser || !canvas || !container) return;

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const env = environment ?? {};
		const N = layers.length;
		const totalH = N * SP;
		const yFor = (i: number) => ((N - 1) / 2 - i) * SP;

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(env.cameraFov ?? 42, 1, 0.1, 100);
		const dist = totalH * 1.25 + 5;
		const defaultCamPos = new THREE.Vector3(dist * 0.32, totalH * 0.08, dist);
		const defaultTarget = new THREE.Vector3(0, 0, 0);
		camera.position.copy(defaultCamPos);

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
			preserveDrawingBuffer: true // needed so toDataURL / drawImage capture works
		});
		renderer.setClearColor(0x000000, 0);
		renderer.setPixelRatio(dpr);

		// Lighting — neutral key so the band colors read true, faint cobalt rim.
		scene.add(new THREE.AmbientLight(0xc8d4ff, env.ambientIntensity ?? 0.7));
		const key = new THREE.DirectionalLight(0xffffff, env.keyIntensity ?? 1.05);
		key.position.set(4, 7, 6);
		scene.add(key);
		const rim = new THREE.DirectionalLight(0x4d7cff, 0.4);
		rim.position.set(-5, -2, -4);
		scene.add(rim);

		// Build one cylinder per layer.
		const group = new THREE.Group();
		const meshes: THREE.Mesh[] = [];
		const geos: THREE.BufferGeometry[] = [];
		const mats: THREE.Material[] = [];
		layers.forEach((layer, i) => {
			const geo = new THREE.CylinderGeometry(RADIUS, RADIUS, LAYER_H, 72, 1);
			const mat = new THREE.MeshStandardMaterial({
				color: new THREE.Color(layer.color),
				metalness: env.metalness ?? 0.12,
				roughness: env.roughness ?? 0.5,
				emissive: new THREE.Color(layer.color),
				emissiveIntensity: 0.0,
				wireframe: env.wireframe ?? false
			});
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.y = yFor(i);
			mesh.userData = { id: layer.id, index: i, baseColor: layer.color };
			group.add(mesh);
			meshes.push(mesh);
			geos.push(geo);
			mats.push(mat);
		});
		scene.add(group);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.target.copy(defaultTarget);
		controls.enableDamping = true;
		controls.dampingFactor = env.damping ?? 0.1;
		controls.autoRotate = !reducedMotion && (env.autoRotate ?? false);
		controls.autoRotateSpeed = 0.8;
		controls.minDistance = 4;
		controls.maxDistance = dist * 2;
		controls.enablePan = false;
		controls.update();

		// Focus tween state.
		let focusActive = false;
		const camGoal = new THREE.Vector3();
		const targetGoal = new THREE.Vector3();
		let appliedSelected: string | null = null;

		function focusLayer(id: string | null) {
			if (!id) {
				camGoal.copy(defaultCamPos);
				targetGoal.copy(defaultTarget);
			} else {
				const m = meshes.find((mm) => mm.userData.id === id);
				if (!m) return;
				const y = m.position.y;
				camGoal.set(RADIUS * 1.7, y + 0.4, RADIUS * 2.7);
				targetGoal.set(0, y, 0);
			}
			focusActive = true;
			if (reducedMotion) {
				camera.position.copy(camGoal);
				controls.target.copy(targetGoal);
				controls.update();
				focusActive = false;
			}
		}

		// Raycasting — distinguish click from drag.
		const raycaster = new THREE.Raycaster();
		const ndc = new THREE.Vector2();
		let downX = 0;
		let downY = 0;
		let hovered: THREE.Mesh | null = null;

		function pointerNdc(ev: PointerEvent) {
			const rect = renderer.domElement.getBoundingClientRect();
			ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
			ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
		}
		function onPointerDown(ev: PointerEvent) {
			downX = ev.clientX;
			downY = ev.clientY;
		}
		function onPointerUp(ev: PointerEvent) {
			if (ev.button !== 0) return; // ignore right/middle click (context menu)
			if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 5) return; // was a drag
			pointerNdc(ev);
			raycaster.setFromCamera(ndc, camera);
			const hit = raycaster.intersectObjects(meshes, false)[0];
			onSelect(hit ? (hit.object.userData.id as string) : null);
		}
		function onPointerMove(ev: PointerEvent) {
			pointerNdc(ev);
			raycaster.setFromCamera(ndc, camera);
			const hit = raycaster.intersectObjects(meshes, false)[0];
			hovered = hit ? (hit.object as THREE.Mesh) : null;
			if (container) container.style.cursor = hovered ? 'pointer' : 'grab';
		}
		renderer.domElement.addEventListener('pointerdown', onPointerDown);
		renderer.domElement.addEventListener('pointerup', onPointerUp);
		renderer.domElement.addEventListener('pointermove', onPointerMove);

		// Resize.
		function resize() {
			if (!container) return;
			const w = container.clientWidth;
			const h = container.clientHeight;
			if (w === 0 || h === 0) return;
			renderer.setSize(w, h, false);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		}
		const ro = new ResizeObserver(resize);
		ro.observe(container);
		resize();

		// Project band centers → screen for the HTML labels.
		const proj = new THREE.Vector3();
		function updateLabels() {
			if (!container) return;
			const w = container.clientWidth;
			const h = container.clientHeight;
			const hoveredId = hovered?.userData.id as string | undefined;
			const out: LabelPos[] = [];
			for (let i = 0; i < meshes.length; i++) {
				const m = meshes[i];
				const y = m.position.y;
				// Effective style = scene default overridden by the layer's own labelStyle.
				const ls: LabelStyle = { ...(defaultLabelStyle ?? {}), ...(layers[i].labelStyle ?? {}) };
				const show = ls.show ?? 'always';
				const anchor: LabelAnchor = ls.anchor ?? 'band';
				const isSel = layers[i].id === selectedMirror;
				const isHov = layers[i].id === hoveredId;

				// Anchor world point relative to the band center.
				let ax = 0;
				let ay = y;
				if (anchor === 'right') ax = RADIUS;
				else if (anchor === 'left') ax = -RADIUS;
				else if (anchor === 'above') ay = y + LAYER_H / 2 + 0.12;
				proj.set(ax, ay, 0).project(camera);

				const inView =
					proj.z < 1 && proj.x >= -1.1 && proj.x <= 1.1 && proj.y >= -1.1 && proj.y <= 1.1;
				let visible: boolean;
				if (show === 'hidden') visible = false;
				else if (show === 'hover') visible = inView && (isHov || isSel);
				else visible = inView;

				out.push({
					id: layers[i].id,
					label: layers[i].label,
					sublabel: layers[i].sublabel,
					x: (proj.x * 0.5 + 0.5) * w + (ls.offsetX ?? 0),
					y: (-proj.y * 0.5 + 0.5) * h + (ls.offsetY ?? 0),
					visible,
					selected: isSel,
					scale: ls.scale ?? 1,
					color: ls.color,
					anchor
				});
			}
			labelPositions = out;
		}

		// Composite the WebGL frame + the projected labels into one opaque PNG.
		doCapture = () => {
			if (!container) return null;
			renderer.render(scene, camera);
			const gl = renderer.domElement;
			const out = document.createElement('canvas');
			out.width = gl.width;
			out.height = gl.height;
			const ctx = out.getContext('2d');
			if (!ctx) return null;
			ctx.fillStyle = '#050a14';
			ctx.fillRect(0, 0, out.width, out.height);
			ctx.drawImage(gl, 0, 0);
			const sx = out.width / container.clientWidth;
			const sy = out.height / container.clientHeight;
			ctx.textBaseline = 'middle';
			for (const lp of labelPositions) {
				if (!lp.visible) continue;
				ctx.textAlign = lp.anchor === 'right' ? 'left' : lp.anchor === 'left' ? 'right' : 'center';
				ctx.shadowColor = 'rgba(0,0,0,0.9)';
				ctx.shadowBlur = 4 * sx;
				ctx.fillStyle = lp.selected ? '#ffe9c2' : (lp.color ?? '#ffffff');
				ctx.font = `600 ${14 * lp.scale * sx}px ui-sans-serif, system-ui, sans-serif`;
				ctx.fillText(lp.label, lp.x * sx, lp.y * sy);
				if (lp.sublabel) {
					ctx.fillStyle = 'rgba(255,255,255,0.72)';
					ctx.font = `400 ${10 * lp.scale * sx}px ui-sans-serif, system-ui, sans-serif`;
					ctx.fillText(lp.sublabel, lp.x * sx, lp.y * sy + 15 * lp.scale * sx);
				}
			}
			ctx.shadowBlur = 0;
			return out.toDataURL('image/png');
		};

		let raf = 0;
		let frame = 0;
		function tick() {
			raf = requestAnimationFrame(tick);
			frame++;

			// React to external selection changes.
			if (selectedMirror !== appliedSelected) {
				appliedSelected = selectedMirror;
				focusLayer(selectedMirror);
			}

			// Smooth camera focus.
			if (focusActive && !reducedMotion) {
				camera.position.lerp(camGoal, 0.12);
				controls.target.lerp(targetGoal, 0.12);
				if (camera.position.distanceTo(camGoal) < 0.02) focusActive = false;
			}

			// Hover + selection emissive.
			for (const m of meshes) {
				const mat = m.material as THREE.MeshStandardMaterial;
				const isSel = m.userData.id === selectedMirror;
				const isHov = m === hovered;
				const goal = isSel ? 0.4 : isHov ? 0.18 : 0.0;
				mat.emissiveIntensity += (goal - mat.emissiveIntensity) * 0.2;
				// Selected band glows amber (the "redline" / you-are-here accent).
				mat.emissive.set(isSel ? 0xf5a623 : (m.userData.baseColor as string));
			}

			controls.update();
			renderer.render(scene, camera);
			if (frame % 2 === 0) updateLabels();
		}
		tick();

		return () => {
			cancelAnimationFrame(raf);
			doCapture = null;
			ro.disconnect();
			renderer.domElement.removeEventListener('pointerdown', onPointerDown);
			renderer.domElement.removeEventListener('pointerup', onPointerUp);
			renderer.domElement.removeEventListener('pointermove', onPointerMove);
			controls.dispose();
			geos.forEach((g) => g.dispose());
			mats.forEach((m) => m.dispose());
			renderer.dispose();
		};
	});
</script>

<div class="stack-root" class:no-grid={environment?.showGrid === false} bind:this={container}>
	<canvas bind:this={canvas}></canvas>
	{#each labelPositions as lp (lp.id)}
		{#if lp.visible}
			<div
				class="band-label anchor-{lp.anchor}"
				class:selected={lp.selected}
				style="left: {lp.x}px; top: {lp.y}px;"
			>
				<span
					class="band-label-text"
					style="font-size: {0.9 * lp.scale}rem;{lp.color && !lp.selected ? ` color: ${lp.color};` : ''}"
					>{lp.label}</span
				>
				{#if lp.sublabel}<span class="band-label-sub" style="font-size: {0.62 * lp.scale}rem;"
						>{lp.sublabel}</span
					>{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.stack-root {
		position: relative;
		width: 100%;
		height: 100%;
		cursor: grab;
		/* Faint engineering-grid backdrop — the drafting-table signature. */
		background-image:
			linear-gradient(rgba(77, 124, 255, 0.06) 1px, transparent 1px),
			linear-gradient(90deg, rgba(77, 124, 255, 0.06) 1px, transparent 1px);
		background-size: 28px 28px;
	}
	.stack-root.no-grid {
		background-image: none;
	}
	.stack-root canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.band-label {
		position: absolute;
		transform: translate(-50%, -50%);
		pointer-events: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		white-space: nowrap;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85), 0 0 1px rgba(0, 0, 0, 1);
		transition: transform 0.15s ease;
	}
	.band-label.anchor-right {
		transform: translate(6px, -50%);
		align-items: flex-start;
		text-align: left;
	}
	.band-label.anchor-left {
		transform: translate(calc(-100% - 6px), -50%);
		align-items: flex-end;
		text-align: right;
	}
	.band-label.anchor-above {
		transform: translate(-50%, calc(-100% - 4px));
	}
	.band-label-text {
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-weight: 600;
		font-size: 0.9rem;
		color: #fff;
		letter-spacing: 0.01em;
	}
	.band-label-sub {
		font-size: 0.62rem;
		color: rgba(255, 255, 255, 0.72);
		font-weight: 400;
	}
	.band-label.selected .band-label-text {
		color: #ffe9c2;
		text-shadow: 0 0 8px rgba(245, 166, 35, 0.7), 0 1px 3px rgba(0, 0, 0, 0.9);
	}
</style>

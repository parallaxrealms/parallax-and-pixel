<script lang="ts">
	/**
	 * Graph3DScene — the 3D Graph/Tree primitive. Renders VizNodes as spheres and
	 * VizEdges as thin tubes between node centers, laid out by a DETERMINISTIC
	 * BFS-depth layout (no Math.random / Date.now — exports are stable). Click a
	 * node → camera tweens to frame it + emits onSelect(id); click empty → null.
	 * Labels are projected HTML overlays (crisp + export-friendly), not in-canvas
	 * text — same technique as StackScene.
	 *
	 * Lifecycle/dispose patterns follow StackScene: onMount init + cleanup, dispose
	 * every geometry/material/renderer on destroy, MSAA via antialias, DPR cap,
	 * prefers-reduced-motion guard.
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import type { VizNode, VizEdge, VizGroup } from '../schema';

	interface Props {
		nodes: VizNode[];
		edges: VizEdge[];
		groups?: VizGroup[];
		selectedId: string | null;
		onSelect: (id: string | null) => void;
	}
	let { nodes, edges, groups, selectedId, onSelect }: Props = $props();

	let container: HTMLDivElement | null = $state(null);
	let canvas: HTMLCanvasElement | null = $state(null);

	// Projected screen positions for the HTML node labels, recomputed each frame.
	type LabelPos = {
		id: string;
		label: string;
		x: number;
		y: number;
		visible: boolean;
		selected: boolean;
		hovered: boolean;
	};
	let labelPositions = $state<LabelPos[]>([]);

	// Mutable mirror the render loop reads (props can't be closed over cleanly).
	let selectedMirror = $state<string | null>(null);
	$effect(() => {
		selectedMirror = selectedId;
	});

	// Composite PNG capture (3D canvas + projected labels drawn on, so the labels
	// — which are HTML overlays, not in the canvas — survive the export).
	let doCapture: (() => string | null) | null = null;
	export function capturePng(): string | null {
		return doCapture ? doCapture() : null;
	}

	const FALLBACK_NODE = '#4d7cff';
	const FALLBACK_EDGE = '#4d7cff';
	// Group tint palette (deterministic by group order) for the translucent halo.
	const GROUP_PALETTE = ['#4d7cff', '#f5a623', '#19c37d', '#c061ff', '#ff5d73', '#2dd4bf', '#fbbf24'];

	onMount(() => {
		if (!browser || !canvas || !container) return;

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		// --- DETERMINISTIC LAYOUT -------------------------------------------------
		// BFS depth from roots (nodes with no incoming edge). Y is set by depth
		// (deeper = lower); within a depth, nodes spread radially on the XZ plane,
		// ordered by their index in the `nodes` array so positions are stable.
		const nodeIndex = new Map<string, number>();
		nodes.forEach((n, i) => nodeIndex.set(n.id, i));

		// Adjacency (only edges that connect two real nodes).
		const incoming = new Map<string, number>();
		const adj = new Map<string, string[]>();
		nodes.forEach((n) => {
			incoming.set(n.id, 0);
			adj.set(n.id, []);
		});
		for (const e of edges) {
			if (!nodeIndex.has(e.source) || !nodeIndex.has(e.target)) continue;
			adj.get(e.source)!.push(e.target);
			incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
		}

		// Roots = no incoming edges; in node order. If a graph is fully cyclic and
		// has no clean root, fall back to the first node so layout still resolves.
		const depth = new Map<string, number>();
		const queue: string[] = [];
		for (const n of nodes) {
			if ((incoming.get(n.id) ?? 0) === 0) {
				depth.set(n.id, 0);
				queue.push(n.id);
			}
		}
		if (queue.length === 0 && nodes.length > 0) {
			depth.set(nodes[0].id, 0);
			queue.push(nodes[0].id);
		}
		// BFS — assign each node depth = min over discovered paths.
		for (let qi = 0; qi < queue.length; qi++) {
			const id = queue[qi];
			const d = depth.get(id) ?? 0;
			for (const nxt of adj.get(id) ?? []) {
				if (!depth.has(nxt)) {
					depth.set(nxt, d + 1);
					queue.push(nxt);
				}
			}
		}
		// Any node never reached (isolated / pure sink in a cycle) → trailing depth.
		let maxAssigned = 0;
		for (const v of depth.values()) maxAssigned = Math.max(maxAssigned, v);
		for (const n of nodes) {
			if (!depth.has(n.id)) {
				maxAssigned += 1;
				depth.set(n.id, maxAssigned);
			}
		}

		// Bucket nodes by depth, preserving node-array order within each bucket.
		const byDepth = new Map<number, string[]>();
		for (const n of nodes) {
			const d = depth.get(n.id) ?? 0;
			if (!byDepth.has(d)) byDepth.set(d, []);
			byDepth.get(d)!.push(n.id);
		}
		const maxDepth = Math.max(0, ...Array.from(byDepth.keys()));

		const LEVEL_GAP = 3.2; // vertical spacing between depth levels
		const BASE_RADIUS = 4.0; // XZ radius for a depth ring with multiple nodes
		const positions = new Map<string, THREE.Vector3>();
		for (const [d, ids] of byDepth) {
			const y = (maxDepth / 2 - d) * LEVEL_GAP;
			const count = ids.length;
			if (count === 1) {
				positions.set(ids[0], new THREE.Vector3(0, y, 0));
			} else {
				// Radius grows a touch with count so rings don't crowd.
				const radius = BASE_RADIUS + count * 0.35;
				ids.forEach((id, k) => {
					const ang = (k / count) * Math.PI * 2;
					positions.set(id, new THREE.Vector3(Math.cos(ang) * radius, y, Math.sin(ang) * radius));
				});
			}
		}

		// Sphere radius from VizNode.value (sane default + clamp).
		const values = nodes.map((n) => (typeof n.value === 'number' && n.value > 0 ? n.value : 0));
		const maxVal = Math.max(0, ...values);
		function radiusFor(n: VizNode): number {
			const base = 0.55;
			if (typeof n.value === 'number' && n.value > 0 && maxVal > 0) {
				// sqrt scale so area-ish reads true; clamp to a readable band.
				return base + Math.sqrt(n.value / maxVal) * 0.85;
			}
			return base;
		}

		// Group → tint color (explicit color, else palette by group order).
		const groupColor = new Map<string, string>();
		(groups ?? []).forEach((g, i) => {
			groupColor.set(g.id, g.color ?? GROUP_PALETTE[i % GROUP_PALETTE.length]);
		});

		// --- SCENE ----------------------------------------------------------------
		const spread = (maxDepth + 1) * LEVEL_GAP + BASE_RADIUS * 2;
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
		const dist = spread * 1.2 + 6;
		const defaultCamPos = new THREE.Vector3(dist * 0.35, spread * 0.12, dist);
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

		// Lighting — neutral key so node colors read true, faint cobalt rim.
		scene.add(new THREE.AmbientLight(0xc8d4ff, 0.7));
		const key = new THREE.DirectionalLight(0xffffff, 1.05);
		key.position.set(4, 7, 6);
		scene.add(key);
		const rim = new THREE.DirectionalLight(0x4d7cff, 0.4);
		rim.position.set(-5, -2, -4);
		scene.add(rim);

		// Disposal registries.
		const geos: THREE.BufferGeometry[] = [];
		const mats: THREE.Material[] = [];

		// --- Group halos (translucent tinted spheres behind member nodes) ---------
		if (groups && groups.length) {
			for (const g of groups) {
				const members = nodes.filter((n) => n.group === g.id && positions.has(n.id));
				if (members.length < 1) continue;
				const center = new THREE.Vector3();
				members.forEach((m) => center.add(positions.get(m.id)!));
				center.multiplyScalar(1 / members.length);
				let r = 1.5;
				members.forEach((m) => {
					r = Math.max(r, center.distanceTo(positions.get(m.id)!) + radiusFor(m) + 0.8);
				});
				const hGeo = new THREE.SphereGeometry(r, 24, 16);
				const hMat = new THREE.MeshBasicMaterial({
					color: new THREE.Color(groupColor.get(g.id) ?? FALLBACK_NODE),
					transparent: true,
					opacity: 0.06,
					depthWrite: false
				});
				const halo = new THREE.Mesh(hGeo, hMat);
				halo.position.copy(center);
				scene.add(halo);
				geos.push(hGeo);
				mats.push(hMat);
			}
		}

		// --- Node spheres ---------------------------------------------------------
		const meshes: THREE.Mesh[] = [];
		nodes.forEach((node, i) => {
			const pos = positions.get(node.id);
			if (!pos) return;
			const r = radiusFor(node);
			const geo = new THREE.SphereGeometry(r, 40, 28);
			const color = new THREE.Color(node.color ?? FALLBACK_NODE);
			const mat = new THREE.MeshStandardMaterial({
				color,
				metalness: 0.15,
				roughness: 0.45,
				emissive: color.clone(),
				emissiveIntensity: 0.0
			});
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.copy(pos);
			mesh.userData = { id: node.id, index: i, baseColor: node.color ?? FALLBACK_NODE };
			scene.add(mesh);
			meshes.push(mesh);
			geos.push(geo);
			mats.push(mat);
		});

		// --- Edges (thin tubes between node centers; 'dep' dimmer) ----------------
		for (const e of edges) {
			const a = positions.get(e.source);
			const b = positions.get(e.target);
			if (!a || !b) continue;
			const dir = new THREE.Vector3().subVectors(b, a);
			const len = dir.length();
			if (len < 1e-4) continue;
			const kind = e.kind;
			const isDep = kind === 'dep';
			const isData = kind === 'data';
			const tubeR = isData ? 0.045 : isDep ? 0.018 : 0.028;
			const opacity = isDep ? 0.35 : kind === 'event' ? 0.55 : 0.7;
			const eGeo = new THREE.CylinderGeometry(tubeR, tubeR, len, 8, 1, true);
			// Cylinder default axis is Y; orient from a→b.
			eGeo.translate(0, len / 2, 0);
			eGeo.rotateX(Math.PI / 2); // align local +Z with the connector
			const eMat = new THREE.MeshBasicMaterial({
				color: new THREE.Color(FALLBACK_EDGE),
				transparent: true,
				opacity,
				depthWrite: false
			});
			const tube = new THREE.Mesh(eGeo, eMat);
			tube.position.copy(a);
			tube.lookAt(b);
			scene.add(tube);
			geos.push(eGeo);
			mats.push(eMat);
		}

		// --- Controls -------------------------------------------------------------
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.target.copy(defaultTarget);
		controls.enableDamping = true;
		controls.dampingFactor = 0.1;
		controls.autoRotate = false;
		controls.minDistance = 3;
		controls.maxDistance = dist * 2.5;
		controls.enablePan = true;
		controls.update();

		// --- Focus tween ----------------------------------------------------------
		let focusActive = false;
		const camGoal = new THREE.Vector3();
		const targetGoal = new THREE.Vector3();
		let appliedSelected: string | null = null;

		function focusNode(id: string | null) {
			if (!id) {
				camGoal.copy(defaultCamPos);
				targetGoal.copy(defaultTarget);
			} else {
				const m = meshes.find((mm) => mm.userData.id === id);
				if (!m) return;
				const p = m.position;
				const back = new THREE.Vector3(2.5, 1.6, 4.0);
				camGoal.copy(p).add(back);
				targetGoal.copy(p);
			}
			focusActive = true;
			if (reducedMotion) {
				camera.position.copy(camGoal);
				controls.target.copy(targetGoal);
				controls.update();
				focusActive = false;
			}
		}

		// --- Raycasting (distinguish click from drag) -----------------------------
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

		// --- Resize ---------------------------------------------------------------
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

		// --- Project node centers → screen for the HTML labels --------------------
		const proj = new THREE.Vector3();
		function updateLabels() {
			if (!container) return;
			const w = container.clientWidth;
			const h = container.clientHeight;
			const hoveredId = hovered?.userData.id as string | undefined;
			const out: LabelPos[] = [];
			for (const m of meshes) {
				const id = m.userData.id as string;
				const geo = m.geometry as THREE.SphereGeometry;
				const r = (geo.parameters as { radius: number }).radius ?? 0.55;
				// Anchor the label just above the sphere top.
				proj.set(m.position.x, m.position.y + r + 0.25, m.position.z).project(camera);
				const inView =
					proj.z < 1 && proj.x >= -1.1 && proj.x <= 1.1 && proj.y >= -1.1 && proj.y <= 1.1;
				const node = nodes[m.userData.index as number];
				out.push({
					id,
					label: node?.label ?? id,
					x: (proj.x * 0.5 + 0.5) * w,
					y: (-proj.y * 0.5 + 0.5) * h,
					visible: inView,
					selected: id === selectedMirror,
					hovered: id === hoveredId
				});
			}
			labelPositions = out;
		}

		// --- Composite PNG capture (WebGL + projected labels) ---------------------
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
			ctx.textAlign = 'center';
			for (const lp of labelPositions) {
				if (!lp.visible) continue;
				ctx.shadowColor = 'rgba(0,0,0,0.9)';
				ctx.shadowBlur = 4 * sx;
				ctx.fillStyle = lp.selected ? '#f5a623' : '#ffffff';
				ctx.font = `600 ${13 * sx}px ui-sans-serif, system-ui, sans-serif`;
				ctx.fillText(lp.label, lp.x * sx, lp.y * sy);
			}
			ctx.shadowBlur = 0;
			return out.toDataURL('image/png');
		};

		// --- Render loop ----------------------------------------------------------
		let raf = 0;
		let frame = 0;
		function tick() {
			raf = requestAnimationFrame(tick);
			frame++;

			// React to external selection changes.
			if (selectedMirror !== appliedSelected) {
				appliedSelected = selectedMirror;
				focusNode(selectedMirror);
			}

			// Smooth camera focus.
			if (focusActive && !reducedMotion) {
				camera.position.lerp(camGoal, 0.12);
				controls.target.lerp(targetGoal, 0.12);
				if (camera.position.distanceTo(camGoal) < 0.02) focusActive = false;
			}

			// Hover + selection emissive (selected glows amber — "you-are-here").
			for (const m of meshes) {
				const mat = m.material as THREE.MeshStandardMaterial;
				const isSel = m.userData.id === selectedMirror;
				const isHov = m === hovered;
				const goal = isSel ? 0.45 : isHov ? 0.2 : 0.0;
				mat.emissiveIntensity += (goal - mat.emissiveIntensity) * 0.2;
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

<div class="graph3d-root" bind:this={container}>
	<canvas bind:this={canvas}></canvas>
	{#each labelPositions as lp (lp.id)}
		{#if lp.visible}
			<div
				class="node-label"
				class:selected={lp.selected}
				class:hovered={lp.hovered}
				style="left: {lp.x}px; top: {lp.y}px;"
			>
				<span class="node-label-text">{lp.label}</span>
			</div>
		{/if}
	{/each}
</div>

<style>
	.graph3d-root {
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
	.graph3d-root canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.node-label {
		position: absolute;
		transform: translate(-50%, calc(-100% - 4px));
		pointer-events: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		white-space: nowrap;
		text-shadow:
			0 1px 3px rgba(0, 0, 0, 0.85),
			0 0 1px rgba(0, 0, 0, 1);
		transition: transform 0.15s ease;
	}
	.node-label-text {
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-weight: 600;
		font-size: 0.82rem;
		color: #fff;
		letter-spacing: 0.01em;
	}
	.node-label.hovered .node-label-text {
		color: #d8e4ff;
	}
	.node-label.selected .node-label-text {
		color: #ffe9c2;
		text-shadow:
			0 0 8px rgba(245, 166, 35, 0.7),
			0 1px 3px rgba(0, 0, 0, 0.9);
	}
</style>

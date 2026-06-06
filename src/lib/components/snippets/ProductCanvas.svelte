<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Canvas, Image as FabricImage, Rect } from 'fabric';
	import type { CatalogVariant } from '@parallaxrealms/pxp-types/ecom';
	import type { DesignData, ProductPrintAreas } from '@parallaxrealms/pxp-types/rune';

	interface Props {
		variant: CatalogVariant;
		currentView: 'front' | 'back';
		design: DesignData | null;
		printArea: ProductPrintAreas;
		onToggleView: () => void;
		onDesignUpdate: (view: 'front' | 'back', design: DesignData | null) => void;
	}

	let { variant, currentView, design, printArea, onToggleView, onDesignUpdate }: Props = $props();

	let canvasEl: HTMLCanvasElement;
	let fabricCanvas: Canvas;

	// caches
	let frontDesignObj: FabricImage | null = null;
	let backDesignObj: FabricImage | null = null;
	let frontBg: FabricImage | null = null;
	let backBg: FabricImage | null = null;

	// active
	let snapLine: Rect | null = null;
	let currentPrintArea = $derived(currentView === 'front' ? printArea.front : printArea.back);

	// ---------------- BACKGROUND ----------------
	async function loadBackground(view: 'front' | 'back') {
		const bgUrl = view === 'front' ? variant.ss_color_front_image : variant.ss_color_back_image;

		if (!bgUrl) return;
		if (view === 'front' && frontBg) return;
		if (view === 'back' && backBg) return;

		const img = await FabricImage.fromURL(bgUrl);
		img.set({
			selectable: false,
			evented: false,
			scaleX: fabricCanvas.width! / img.width!,
			scaleY: fabricCanvas.height! / img.height!
		});

		if (view === 'front') frontBg = img;
		else backBg = img;
	}

	function applyBackground() {
		const bg = currentView === 'front' ? frontBg : backBg;
		if (bg) {
			fabricCanvas.backgroundImage = bg;
			fabricCanvas.renderAll();
		}
	}

	// ---------------- PRINT AREA ----------------
	function drawPrintArea() {
		if (!currentPrintArea) return;
		const pa = new Rect({
			left: currentPrintArea.x,
			top: currentPrintArea.y,
			width: currentPrintArea.width,
			height: currentPrintArea.height,
			stroke: 'cyan',
			strokeDashArray: [5, 5],
			fill: 'transparent',
			selectable: false,
			evented: false
		});
		(pa as any).isPrintArea = true;
		fabricCanvas.add(pa);
	}

	// ---------------- DESIGN ----------------
	// Replace the addOrUpdateDesign function in ProductCanvas.svelte
	async function addOrUpdateDesign(d: DesignData) {
		// Determine which design object to work with based on view
		let isForFront = currentView === 'front';
		let targetObj = isForFront ? frontDesignObj : backDesignObj;

		// If we already have an object for this design, update it
		if (targetObj && (targetObj as any).data?.id === d.id) {
			targetObj.set({
				left: d.position.x - (d.width * d.scale) / 2,
				top: d.position.y - (d.height * d.scale) / 2,
				scaleX: d.scale,
				scaleY: d.scale,
				angle: d.rotation,
				visible: true,
				selectable: true,
				evented: true
			});
			fabricCanvas.renderAll();
			return;
		}

		// Create new design object
		try {
			const newObj = await FabricImage.fromURL(d.imageUrl);
			newObj.set({
				left: d.position.x - (d.width * d.scale) / 2,
				top: d.position.y - (d.height * d.scale) / 2,
				scaleX: d.scale,
				scaleY: d.scale,
				angle: d.rotation,
				hasControls: true,
				lockUniScaling: true,
				visible: true,
				selectable: true,
				evented: true
			});
			(newObj as any).data = { id: d.id, view: currentView };

			// Remove old object if exists
			if (targetObj) {
				fabricCanvas.remove(targetObj);
			}

			// Add new object and store reference
			fabricCanvas.add(newObj);
			fabricCanvas.setActiveObject(newObj);

			if (isForFront) {
				frontDesignObj = newObj;
			} else {
				backDesignObj = newObj;
			}

			fabricCanvas.renderAll();
		} catch (error) {
			console.error('Error loading design image:', error);
		}
	}

	// ---------------- SNAP + UPDATE ----------------
	function handleMoving(e: any) {
		const obj = e.target as FabricImage;
		if (!obj || !currentPrintArea) return;

		const centerX = currentPrintArea.x + currentPrintArea.width / 2;
		const objCenterX = obj.left! + (obj.width! * obj.scaleX!) / 2;

		if (Math.abs(objCenterX - centerX) < 10) {
			if (!snapLine) {
				snapLine = new Rect({
					left: centerX,
					top: currentPrintArea.y,
					width: 1,
					height: currentPrintArea.height,
					fill: '#1fff7d',
					selectable: false,
					evented: false
				});
				fabricCanvas.add(snapLine);
			}
		} else if (snapLine) {
			fabricCanvas.remove(snapLine);
			snapLine = null;
		}
		fabricCanvas.renderAll();
	}

	function handleModified() {
		let designObj = currentView === 'front' ? frontDesignObj : backDesignObj;
		if (!designObj || !design || !currentPrintArea) return;

		if (snapLine) {
			const centerX = currentPrintArea.x + currentPrintArea.width / 2;
			designObj.left = centerX - (designObj.width! * designObj.scaleX!) / 2;
			fabricCanvas.remove(snapLine);
			snapLine = null;
		}

		const updated: DesignData = {
			...design,
			position: {
				x: designObj.left! + (designObj.width! * designObj.scaleX!) / 2,
				y: designObj.top! + (designObj.height! * designObj.scaleY!) / 2
			},
			scale: designObj.scaleX || 1,
			rotation: designObj.angle || 0
		};

		onDesignUpdate(currentView, updated);
		fabricCanvas.renderAll();
	}

	// ---------------- LIFECYCLE ----------------
	onMount(async () => {
		fabricCanvas = new Canvas(canvasEl, {
			preserveObjectStacking: true,
			selection: false
		});

		await loadBackground('front');
		await loadBackground('back');

		applyBackground();
		drawPrintArea();

		fabricCanvas.on('object:moving', handleMoving);
		fabricCanvas.on('object:modified', handleModified);
	});

	onDestroy(() => {
		fabricCanvas?.dispose();
	});

	// ---------------- REACTIONS ----------------
	//  view change effect
	$effect(() => {
		if (!fabricCanvas) return;

		// Immediately discard active object to hide selection
		fabricCanvas.discardActiveObject();

		// Small delay for visual smoothness
		setTimeout(() => {
			// Apply correct background
			applyBackground();

			// Update visibility and interactivity
			if (frontDesignObj) {
				const isFrontView = currentView === 'front';
				frontDesignObj.set({
					visible: isFrontView,
					selectable: isFrontView,
					evented: isFrontView
				});
			}

			if (backDesignObj) {
				const isBackView = currentView === 'back';
				backDesignObj.set({
					visible: isBackView,
					selectable: isBackView,
					evented: isBackView
				});
			}

			// Clear and redraw print area
			fabricCanvas.getObjects('rect').forEach((obj) => {
				if ((obj as any).isPrintArea) fabricCanvas.remove(obj);
			});
			drawPrintArea();

			// Set active object for current view if exists
			const currentDesignObj = currentView === 'front' ? frontDesignObj : backDesignObj;
			if (currentDesignObj) {
				fabricCanvas.setActiveObject(currentDesignObj);
			}

			fabricCanvas.renderAll();
		}, 10);
	});

	// design change
	$effect(() => {
		if (!fabricCanvas) return;

		// Only work with the design for the current view
		if (currentView === 'front' && design) {
			// Only update front design
			if (!frontDesignObj || (frontDesignObj as any).data?.id !== design.id) {
				addOrUpdateDesign(design).catch(console.error);
			}
		} else if (currentView === 'back' && design) {
			// Only update back design
			if (!backDesignObj || (backDesignObj as any).data?.id !== design.id) {
				addOrUpdateDesign(design).catch(console.error);
			}
		}
	});
</script>

<div class="canvas-wrapper">
	<div class="toolbar">
		<button onclick={onToggleView}>
			Switch to {currentView === 'front' ? 'Back' : 'Front'}
		</button>
	</div>
	<canvas bind:this={canvasEl} width="500" height="500"></canvas>
</div>

<style>
	.canvas-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.toolbar {
		margin-bottom: 0.5rem;
	}
</style>

<script lang="ts">
	/**
	 * Mockup Creator — fabric.js editor ported from 9realms VULCAN, reworked for
	 * Parallax & Pixel.
	 *
	 * REWORK vs 9realms:
	 *  - No product catalog / catalog_variants: each view's BACKGROUND comes from a
	 *    device upload or a Media Library pick (stored per-view as `background_url`).
	 *  - No `designs` DB table: each view's DESIGN comes from a device upload or a
	 *    Media Library pick (one design per view, with replace confirmation).
	 *  - Single-tenant: outputs go to a `mockups/` folder in the `media_library`
	 *    bucket (no PUBLIC_SITE_ID prefix).
	 *  - Projects persist to public.mockup_projects (RLS via pxp_is_admin); the
	 *    session supabase client is used directly (no `.schema('nine')`).
	 *
	 * Everything else (the fabric canvas, view tabs, zoom, toolbar, snap guides,
	 * side-view perspective grid, export strip) is preserved.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type {
		MockupProject,
		MockupViews,
		MockupViewType,
		DesignPlacement
	} from '$lib/types/mockups';
	import { emptyViews } from '$lib/types/mockups';
	import MediaPickerDialog from './MediaPickerDialog.svelte';
	import {
		ArrowLeft,
		Save,
		Download,
		Trash2,
		ArrowUp,
		ArrowDown,
		AlignCenterHorizontal,
		AlignCenterVertical,
		ZoomIn,
		ZoomOut,
		Upload,
		Image as ImageIcon,
		ImagePlus,
		RotateCcw,
		SeparatorVertical,
		SeparatorHorizontal,
		Grid3x3,
		Sliders,
		Loader2
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { onMount, onDestroy } from 'svelte';
	import { Canvas, FabricImage, type FabricObject } from 'fabric';

	interface Props {
		supabase: SupabaseClient;
		mockupToEdit?: MockupProject | null;
		oncomplete: () => void;
	}

	let { supabase, mockupToEdit = null, oncomplete }: Props = $props();

	// Canvas state
	let canvasContainer = $state<HTMLDivElement | null>(null);
	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let fabricCanvas: Canvas | null = $state(null);
	const CANVAS_SIZE = 800;
	let zoom = $state(0.7);

	// Snap-to-center state
	let snapVertical = $state(true);
	let snapHorizontal = $state(true);
	let isSnappedVertical = $state(false);
	let isSnappedHorizontal = $state(false);
	const SNAP_MARGIN = 8;
	const CENTER_LINE_COLOR = 'rgba(0, 165, 207, 0.85)'; // accent-primary

	// Perspective grid (side view only)
	type PerspectiveDirection = 'left' | 'right' | null;
	let perspectiveGrid = $state<PerspectiveDirection>(null);
	const PERSPECTIVE_GRID_COLOR = 'rgba(0, 165, 207, 0.7)'; // accent-primary
	const PERSPECTIVE_CONFIG = {
		designAreaWidth: 0.5,
		designAreaHeight: 0.6,
		perspectiveSkew: 0.15,
		verticalLines: 5,
		horizontalLines: 5
	};

	// Mockup state
	let mockupName = $state('');
	let currentView = $state<MockupViewType>('front');
	let views = $state<MockupViews>(emptyViews());
	let hasUnsavedChanges = $state(false);

	// Every view is always available in PxP (background is per-view, optional).
	const ALL_VIEWS: MockupViewType[] = ['front', 'back', 'side'];

	let currentBackgroundUrl = $derived(views[currentView]?.background_url ?? null);
	let canEdit = $derived(!!currentBackgroundUrl);

	// Upload / picker UI state
	let isUploading = $state(false);
	let bgPickerOpen = $state(false);
	let designPickerOpen = $state(false);
	let bgFileInput = $state<HTMLInputElement | null>(null);
	let designFileInput = $state<HTMLInputElement | null>(null);

	// Export state
	let isExportDialogOpen = $state(false);
	let isExporting = $state(false);
	let exportOptions = $state<Record<string, boolean>>({
		front: true,
		back: true,
		side: true,
		strip: true,
		saveToLibrary: false
	});

	// Save state
	let isSaving = $state(false);

	// Replace-design confirmation
	let isReplaceDialogOpen = $state(false);
	let pendingDesign = $state<{ imageUrl: string; designName: string } | null>(null);

	let selectedObject = $state<FabricImage | null>(null);

	// Guards
	let isRestoring = false;
	let isAddingDesign = false;

	// =========================================
	// Initialization
	// =========================================
	function initialize() {
		if (mockupToEdit) {
			mockupName = mockupToEdit.name;
			views = normalizeViews(mockupToEdit.views);
			// First view that has a background, else 'front'
			currentView = ALL_VIEWS.find((v) => views[v].background_url) ?? 'front';
		}
	}

	// Tolerate older/partial shapes when loading a project.
	function normalizeViews(raw: unknown): MockupViews {
		const base = emptyViews();
		if (!raw || typeof raw !== 'object') return base;
		const r = raw as Record<string, unknown>;
		for (const v of ALL_VIEWS) {
			const entry = r[v];
			if (Array.isArray(entry)) {
				// Legacy 9realms shape: views[view] was a DesignPlacement[]
				base[v] = { background_url: null, placements: entry as DesignPlacement[] };
			} else if (entry && typeof entry === 'object') {
				const e = entry as Record<string, unknown>;
				base[v] = {
					background_url: (e.background_url as string) ?? null,
					placements: Array.isArray(e.placements) ? (e.placements as DesignPlacement[]) : []
				};
			}
		}
		return base;
	}

	// =========================================
	// Canvas Management
	// =========================================
	function initCanvas() {
		if (!canvasElement) return;

		if (fabricCanvas) fabricCanvas.dispose();

		fabricCanvas = new Canvas(canvasElement, {
			width: CANVAS_SIZE,
			height: CANVAS_SIZE,
			backgroundColor: '#0f172a', // slate-900
			selection: true
		});

		fabricCanvas.on('selection:created', handleSelection);
		fabricCanvas.on('selection:updated', handleSelection);
		fabricCanvas.on('selection:cleared', () => {
			selectedObject = null;
		});
		fabricCanvas.on('object:modified', handleObjectModified);
		fabricCanvas.on('object:moving', handleObjectMoving);
		fabricCanvas.on('after:render', () => {
			const ctx = fabricCanvas?.getTopContext();
			if (ctx) ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
			drawCenterGuides();
			drawPerspectiveGrid();
		});
		fabricCanvas.on('mouse:up', () => {
			isSnappedVertical = false;
			isSnappedHorizontal = false;
			fabricCanvas?.renderAll();
		});

		loadBackgroundImage();
		restoreViewDesigns();
	}

	function handleObjectMoving(e: { target?: FabricObject }) {
		if (!e.target) return;
		const obj = e.target;
		const objCenter = obj.getCenterPoint();
		const canvasCenter = CANVAS_SIZE / 2;

		if (snapVertical && Math.abs(objCenter.x - canvasCenter) < SNAP_MARGIN) {
			obj.setPositionByOrigin({ x: canvasCenter, y: objCenter.y } as any, 'center', 'center');
			isSnappedVertical = true;
		} else {
			isSnappedVertical = false;
		}

		if (snapHorizontal && Math.abs(objCenter.y - canvasCenter) < SNAP_MARGIN) {
			obj.setPositionByOrigin(
				{ x: obj.getCenterPoint().x, y: canvasCenter } as any,
				'center',
				'center'
			);
			isSnappedHorizontal = true;
		} else {
			isSnappedHorizontal = false;
		}
	}

	function drawCenterGuides() {
		if (!fabricCanvas) return;
		if (!isSnappedVertical && !isSnappedHorizontal) return;
		const ctx = fabricCanvas.getTopContext();
		if (!ctx) return;

		ctx.save();
		ctx.strokeStyle = CENTER_LINE_COLOR;
		ctx.lineWidth = 2;
		ctx.setLineDash([5, 5]);
		const center = CANVAS_SIZE / 2;

		if (snapVertical && isSnappedVertical) {
			ctx.beginPath();
			ctx.moveTo(center, 0);
			ctx.lineTo(center, CANVAS_SIZE);
			ctx.stroke();
		}
		if (snapHorizontal && isSnappedHorizontal) {
			ctx.beginPath();
			ctx.moveTo(0, center);
			ctx.lineTo(CANVAS_SIZE, center);
			ctx.stroke();
		}
		ctx.restore();
	}

	function drawPerspectiveGrid() {
		if (!fabricCanvas) return;
		if (perspectiveGrid === null || currentView !== 'side') return;
		const ctx = fabricCanvas.getTopContext();
		if (!ctx) return;

		ctx.save();
		const { designAreaWidth, designAreaHeight, perspectiveSkew, verticalLines, horizontalLines } =
			PERSPECTIVE_CONFIG;
		const areaWidth = CANVAS_SIZE * designAreaWidth;
		const areaHeight = CANVAS_SIZE * designAreaHeight;
		const centerX = CANVAS_SIZE / 2;
		const centerY = CANVAS_SIZE / 2;
		const skewAmount = areaHeight * perspectiveSkew;

		let topLeft: { x: number; y: number };
		let topRight: { x: number; y: number };
		let bottomLeft: { x: number; y: number };
		let bottomRight: { x: number; y: number };

		if (perspectiveGrid === 'left') {
			topLeft = { x: centerX - areaWidth / 2, y: centerY - areaHeight / 2 };
			bottomLeft = { x: centerX - areaWidth / 2, y: centerY + areaHeight / 2 };
			topRight = { x: centerX + areaWidth / 2, y: centerY - areaHeight / 2 + skewAmount };
			bottomRight = { x: centerX + areaWidth / 2, y: centerY + areaHeight / 2 - skewAmount };
		} else {
			topLeft = { x: centerX - areaWidth / 2, y: centerY - areaHeight / 2 + skewAmount };
			bottomLeft = { x: centerX - areaWidth / 2, y: centerY + areaHeight / 2 - skewAmount };
			topRight = { x: centerX + areaWidth / 2, y: centerY - areaHeight / 2 };
			bottomRight = { x: centerX + areaWidth / 2, y: centerY + areaHeight / 2 };
		}

		ctx.strokeStyle = PERSPECTIVE_GRID_COLOR;
		ctx.lineWidth = 1.5;
		ctx.setLineDash([8, 4]);
		ctx.beginPath();
		ctx.moveTo(topLeft.x, topLeft.y);
		ctx.lineTo(topRight.x, topRight.y);
		ctx.lineTo(bottomRight.x, bottomRight.y);
		ctx.lineTo(bottomLeft.x, bottomLeft.y);
		ctx.closePath();
		ctx.stroke();

		ctx.lineWidth = 1;
		for (let i = 1; i < verticalLines; i++) {
			const t = i / verticalLines;
			ctx.beginPath();
			ctx.moveTo(topLeft.x + (topRight.x - topLeft.x) * t, topLeft.y + (topRight.y - topLeft.y) * t);
			ctx.lineTo(
				bottomLeft.x + (bottomRight.x - bottomLeft.x) * t,
				bottomLeft.y + (bottomRight.y - bottomLeft.y) * t
			);
			ctx.stroke();
		}
		for (let i = 1; i < horizontalLines; i++) {
			const t = i / horizontalLines;
			ctx.beginPath();
			ctx.moveTo(topLeft.x + (bottomLeft.x - topLeft.x) * t, topLeft.y + (bottomLeft.y - topLeft.y) * t);
			ctx.lineTo(
				topRight.x + (bottomRight.x - topRight.x) * t,
				topRight.y + (bottomRight.y - topRight.y) * t
			);
			ctx.stroke();
		}

		ctx.setLineDash([]);
		ctx.fillStyle = PERSPECTIVE_GRID_COLOR;
		ctx.font = 'bold 14px sans-serif';
		ctx.textAlign = 'center';
		const label = perspectiveGrid === 'left' ? 'Left 45°' : 'Right 45°';
		const labelY = topLeft.y - 20;
		ctx.fillText(label, centerX, labelY);

		const arrowY = labelY - 15;
		const arrowLength = 30;
		ctx.beginPath();
		if (perspectiveGrid === 'left') {
			ctx.moveTo(centerX + arrowLength / 2, arrowY);
			ctx.lineTo(centerX - arrowLength / 2, arrowY);
			ctx.moveTo(centerX - arrowLength / 2, arrowY);
			ctx.lineTo(centerX - arrowLength / 2 + 8, arrowY - 5);
			ctx.moveTo(centerX - arrowLength / 2, arrowY);
			ctx.lineTo(centerX - arrowLength / 2 + 8, arrowY + 5);
		} else {
			ctx.moveTo(centerX - arrowLength / 2, arrowY);
			ctx.lineTo(centerX + arrowLength / 2, arrowY);
			ctx.moveTo(centerX + arrowLength / 2, arrowY);
			ctx.lineTo(centerX + arrowLength / 2 - 8, arrowY - 5);
			ctx.moveTo(centerX + arrowLength / 2, arrowY);
			ctx.lineTo(centerX + arrowLength / 2 - 8, arrowY + 5);
		}
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.restore();
	}

	function handleSelection(e: { selected?: FabricObject[] }) {
		if (e.selected && e.selected.length > 0) selectedObject = e.selected[0] as FabricImage;
	}

	function handleObjectModified() {
		hasUnsavedChanges = true;
		saveCurrentViewState();
	}

	async function loadBackgroundImage() {
		const url = currentBackgroundUrl;
		if (!url || !fabricCanvas) return;
		try {
			const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
			const scale = Math.min(CANVAS_SIZE / img.width!, CANVAS_SIZE / img.height!);
			img.scale(scale);
			img.set({
				left: (CANVAS_SIZE - img.width! * scale) / 2,
				top: (CANVAS_SIZE - img.height! * scale) / 2,
				selectable: false,
				evented: false,
				hoverCursor: 'default'
			});
			fabricCanvas.backgroundImage = img;
			fabricCanvas.renderAll();
		} catch (err) {
			console.error('Error loading background image:', err);
			toast.error('Failed to load background image');
		}
	}

	function saveCurrentViewState() {
		if (!fabricCanvas) return;
		const objects = fabricCanvas.getObjects() as FabricImage[];
		const placements: DesignPlacement[] = objects.map((obj) => ({
			id: (obj as any).placementId || crypto.randomUUID(),
			designName: (obj as any).designName || '',
			imageUrl: (obj as any).imageUrl || '',
			position: { x: obj.left || 0, y: obj.top || 0 },
			scale: obj.scaleX || 1,
			rotation: obj.angle || 0,
			width: obj.width || 0,
			height: obj.height || 0,
			skewY: obj.skewY || 0
		}));
		views[currentView] = { ...views[currentView], placements };
	}

	async function restoreViewDesigns() {
		if (!fabricCanvas) return;
		isRestoring = true;
		const objects = fabricCanvas.getObjects();
		for (let i = objects.length - 1; i >= 0; i--) fabricCanvas.remove(objects[i]);

		const placements = views[currentView].placements;
		if (placements.length > 0) {
			const p = placements[0];
			await addDesignToCanvas(p.imageUrl, p.designName, {
				left: p.position.x,
				top: p.position.y,
				scaleX: p.scale,
				scaleY: p.scale,
				angle: p.rotation,
				placementId: p.id,
				skewY: p.skewY ?? 0
			});
		}
		isRestoring = false;
	}

	// One design per view → confirm before replacing.
	function requestAddDesign(imageUrl: string, designName: string) {
		if (!fabricCanvas || !canEdit) return;
		if (views[currentView].placements.length > 0) {
			pendingDesign = { imageUrl, designName };
			isReplaceDialogOpen = true;
			return;
		}
		addDesignToCanvas(imageUrl, designName);
	}

	function confirmReplaceDesign() {
		if (!pendingDesign || !fabricCanvas) return;
		const objects = fabricCanvas.getObjects();
		for (let i = objects.length - 1; i >= 0; i--) fabricCanvas.remove(objects[i]);
		views[currentView] = { ...views[currentView], placements: [] };
		addDesignToCanvas(pendingDesign.imageUrl, pendingDesign.designName);
		pendingDesign = null;
		isReplaceDialogOpen = false;
	}

	async function addDesignToCanvas(
		imageUrl: string,
		designName: string,
		options?: {
			left?: number;
			top?: number;
			scaleX?: number;
			scaleY?: number;
			angle?: number;
			placementId?: string;
			skewY?: number;
		}
	) {
		if (!fabricCanvas) return;
		if (isAddingDesign && !isRestoring) return;
		if (!isRestoring) isAddingDesign = true;

		try {
			const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
			const left = options?.left ?? CANVAS_SIZE / 2 - (img.width || 100) / 2;
			const top = options?.top ?? CANVAS_SIZE / 2 - (img.height || 100) / 2;
			img.set({
				left,
				top,
				scaleX: options?.scaleX ?? 0.5,
				scaleY: options?.scaleY ?? 0.5,
				angle: options?.angle ?? 0,
				skewY: options?.skewY ?? 0,
				cornerColor: '#00a5cf',
				cornerStrokeColor: '#fff',
				cornerSize: 12,
				transparentCorners: false,
				borderColor: '#00a5cf',
				borderScaleFactor: 2
			});
			(img as any).placementId = options?.placementId || crypto.randomUUID();
			(img as any).designName = designName;
			(img as any).imageUrl = imageUrl;

			fabricCanvas.add(img);
			fabricCanvas.setActiveObject(img);
			fabricCanvas.renderAll();

			if (!isRestoring) {
				hasUnsavedChanges = true;
				saveCurrentViewState();
			}
		} catch (err) {
			console.error('Error adding design to canvas:', err);
			toast.error('Failed to add design');
		} finally {
			if (!isRestoring) isAddingDesign = false;
		}
	}

	// =========================================
	// Background sources (REWORK: device upload / Media Library)
	// =========================================
	function setBackgroundUrl(url: string) {
		views[currentView] = { ...views[currentView], background_url: url };
		hasUnsavedChanges = true;
		initCanvas();
	}

	async function handleBgFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		isUploading = true;
		try {
			const url = await uploadFileToMediaLibrary(file, `bg-${currentView}`);
			if (url) {
				setBackgroundUrl(url);
				toast.success('Background uploaded');
			}
		} finally {
			isUploading = false;
		}
	}

	function onBgPicked(media: { url: string; name: string }) {
		setBackgroundUrl(media.url);
		bgPickerOpen = false;
	}

	// =========================================
	// Design sources (REWORK: device upload / Media Library)
	// =========================================
	async function handleDesignFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !canEdit) return;
		isUploading = true;
		try {
			const url = await uploadFileToMediaLibrary(file, 'design');
			if (url) requestAddDesign(url, file.name);
		} finally {
			isUploading = false;
		}
	}

	function onDesignPicked(media: { url: string; name: string }) {
		designPickerOpen = false;
		requestAddDesign(media.url, media.name);
	}

	// =========================================
	// View Switching
	// =========================================
	function switchView(view: MockupViewType) {
		if (view === currentView) return;
		saveCurrentViewState();
		if (view !== 'side') perspectiveGrid = null;
		currentView = view;
		initCanvas();
	}

	function hasDesignsInView(view: MockupViewType): boolean {
		return views[view].placements.length > 0;
	}
	function hasBackgroundInView(view: MockupViewType): boolean {
		return !!views[view].background_url;
	}

	// =========================================
	// Toolbar actions
	// =========================================
	function deleteSelected() {
		if (!fabricCanvas || !selectedObject) return;
		fabricCanvas.remove(selectedObject);
		selectedObject = null;
		hasUnsavedChanges = true;
		saveCurrentViewState();
	}
	function bringForward() {
		if (!fabricCanvas || !selectedObject) return;
		fabricCanvas.bringObjectForward(selectedObject);
		hasUnsavedChanges = true;
	}
	function sendBackward() {
		if (!fabricCanvas || !selectedObject) return;
		fabricCanvas.sendObjectBackwards(selectedObject);
		hasUnsavedChanges = true;
	}
	function centerHorizontal() {
		if (!fabricCanvas || !selectedObject) return;
		selectedObject.set('left', CANVAS_SIZE / 2 - (selectedObject.width! * selectedObject.scaleX!) / 2);
		fabricCanvas.renderAll();
		hasUnsavedChanges = true;
		saveCurrentViewState();
	}
	function centerVertical() {
		if (!fabricCanvas || !selectedObject) return;
		selectedObject.set('top', CANVAS_SIZE / 2 - (selectedObject.height! * selectedObject.scaleY!) / 2);
		fabricCanvas.renderAll();
		hasUnsavedChanges = true;
		saveCurrentViewState();
	}
	function handleZoom(delta: number) {
		zoom = Math.max(0.5, Math.min(2, zoom + delta));
		if (canvasContainer) canvasContainer.style.transform = `scale(${zoom})`;
	}
	function resetZoom() {
		zoom = 1;
		if (canvasContainer) canvasContainer.style.transform = 'scale(1)';
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			const tag = document.activeElement?.tagName;
			if (selectedObject && tag !== 'INPUT' && tag !== 'TEXTAREA') {
				e.preventDefault();
				deleteSelected();
			}
		}
	}
	function applyPerspectiveSkew() {
		if (!fabricCanvas || !selectedObject || !perspectiveGrid) return;
		selectedObject.set('skewY', perspectiveGrid === 'left' ? 15 : -15);
		fabricCanvas.renderAll();
		hasUnsavedChanges = true;
		saveCurrentViewState();
	}

	// =========================================
	// Export
	// =========================================
	async function exportView(view: MockupViewType): Promise<string | null> {
		if (!fabricCanvas) return null;
		const originalView = currentView;
		if (view !== currentView) {
			saveCurrentViewState();
			currentView = view;
			await loadBackgroundImage();
			await restoreViewDesigns();
		}
		await new Promise((r) => setTimeout(r, 100));
		const dataUrl = fabricCanvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
		if (view !== originalView) {
			currentView = originalView;
			initCanvas();
		}
		return dataUrl;
	}

	async function generateStripImage(): Promise<string | null> {
		const viewsToInclude = ALL_VIEWS.filter((v) => hasBackgroundInView(v) && hasDesignsInView(v));
		if (viewsToInclude.length === 0) return null;

		const gap = 20;
		const metaHeight = 100;
		const viewSize = CANVAS_SIZE;
		const stripWidth = viewsToInclude.length * viewSize + (viewsToInclude.length - 1) * gap;
		const stripHeight = viewSize + metaHeight;

		const stripCanvas = document.createElement('canvas');
		stripCanvas.width = stripWidth;
		stripCanvas.height = stripHeight;
		const ctx = stripCanvas.getContext('2d')!;
		ctx.fillStyle = '#0f172a'; // slate-900
		ctx.fillRect(0, 0, stripWidth, stripHeight);

		let x = 0;
		for (const view of viewsToInclude) {
			const dataUrl = await exportView(view);
			if (dataUrl) {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				await new Promise((resolve) => {
					img.onload = resolve;
					img.src = dataUrl;
				});
				ctx.drawImage(img, x, 0, viewSize, viewSize);
			}
			x += viewSize + gap;
		}

		// Metadata bar
		ctx.fillStyle = '#020617'; // slate-950
		ctx.fillRect(0, viewSize, stripWidth, metaHeight);
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 24px sans-serif';
		ctx.fillText(mockupName || 'Mockup', 20, viewSize + 45);
		ctx.font = '18px sans-serif';
		ctx.fillStyle = '#00a5cf'; // accent-primary
		ctx.fillText(viewsToInclude.map((v) => v[0].toUpperCase() + v.slice(1)).join(' · '), 20, viewSize + 75);
		ctx.fillStyle = '#94a3b8'; // slate-400
		ctx.fillText(new Date().toLocaleDateString(), stripWidth - 150, viewSize + 75);

		return stripCanvas.toDataURL('image/png');
	}

	function dataUrlToBlob(dataUrl: string): Blob {
		const arr = dataUrl.split(',');
		const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
		const bstr = atob(arr[1]);
		let n = bstr.length;
		const u8arr = new Uint8Array(n);
		while (n--) u8arr[n] = bstr.charCodeAt(n);
		return new Blob([u8arr], { type: mime });
	}

	function downloadDataUrl(dataUrl: string, filename: string) {
		const link = document.createElement('a');
		link.href = dataUrl;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	// =========================================
	// Media Library writes (recipe: upload → getPublicUrl → upsert media_assets)
	// =========================================
	async function uploadFileToMediaLibrary(file: File, kind: string): Promise<string | null> {
		try {
			const { data: userData } = await supabase.auth.getUser();
			const safeName = (file.name.replace(/\.[^.]+$/, '') || kind)
				.replace(/[^a-z0-9]/gi, '-')
				.toLowerCase();
			const ext = file.name.split('.').pop() || 'png';
			const path = `mockups/${kind}-${safeName}-${Date.now()}.${ext}`;

			const { error: upErr } = await supabase.storage
				.from('media_library')
				.upload(path, file, { upsert: true });
			if (upErr) throw upErr;

			const { data: pub } = supabase.storage.from('media_library').getPublicUrl(path);

			const { error: dbErr } = await supabase.from('media_assets').upsert(
				{
					bucket: 'media_library',
					path,
					url: pub.publicUrl,
					type: 'image',
					size: file.size,
					content_type: file.type || `image/${ext}`,
					uploaded_by: userData?.user?.id ?? null,
					metadata: { source: 'mockup-creator', kind }
				},
				{ onConflict: 'path' }
			);
			if (dbErr) throw dbErr;
			return pub.publicUrl;
		} catch (err) {
			console.error('Upload to Media Library error:', err);
			toast.error('Upload failed');
			return null;
		}
	}

	// Upload a generated (rendered) PNG data URL to the Media Library.
	async function uploadDataUrlToMediaLibrary(dataUrl: string, filename: string): Promise<string | null> {
		try {
			const { data: userData } = await supabase.auth.getUser();
			const path = `mockups/${filename}`;
			const blob = dataUrlToBlob(dataUrl);

			const { error: upErr } = await supabase.storage
				.from('media_library')
				.upload(path, blob, { upsert: true });
			if (upErr) throw upErr;

			const { data: pub } = supabase.storage.from('media_library').getPublicUrl(path);

			await supabase.from('media_assets').upsert(
				{
					bucket: 'media_library',
					path,
					url: pub.publicUrl,
					type: 'image',
					size: blob.size,
					content_type: 'image/png',
					uploaded_by: userData?.user?.id ?? null,
					metadata: { generated: true, source: 'mockup-creator', mockup_name: mockupName }
				},
				{ onConflict: 'path' }
			);
			return pub.publicUrl;
		} catch (err) {
			console.error('Upload generated PNG error:', err);
			return null;
		}
	}

	async function handleExport() {
		isExporting = true;
		try {
			const timestamp = Date.now();
			const safeName = mockupName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'mockup';
			let downloadCount = 0;
			let uploadedCount = 0;

			for (const view of ALL_VIEWS) {
				if (exportOptions[view] && hasBackgroundInView(view) && hasDesignsInView(view)) {
					const dataUrl = await exportView(view);
					if (dataUrl) {
						downloadDataUrl(dataUrl, `${mockupName || 'mockup'}-${view}.png`);
						downloadCount++;
						if (exportOptions.saveToLibrary) {
							const url = await uploadDataUrlToMediaLibrary(dataUrl, `${safeName}-${view}-${timestamp}.png`);
							if (url) uploadedCount++;
						}
					}
				}
			}

			if (exportOptions.strip) {
				const stripDataUrl = await generateStripImage();
				if (stripDataUrl) {
					downloadDataUrl(stripDataUrl, `${mockupName || 'mockup'}-strip.png`);
					downloadCount++;
					if (exportOptions.saveToLibrary) {
						const url = await uploadDataUrlToMediaLibrary(stripDataUrl, `${safeName}-strip-${timestamp}.png`);
						if (url) uploadedCount++;
					}
				}
			}

			if (exportOptions.saveToLibrary && uploadedCount > 0) {
				toast.success(`Exported ${downloadCount} file(s); saved ${uploadedCount} to Media Library`);
			} else {
				toast.success(`Exported ${downloadCount} file(s)`);
			}
			isExportDialogOpen = false;
		} catch (err) {
			console.error('Export error:', err);
			toast.error('Failed to export');
		} finally {
			isExporting = false;
		}
	}

	// =========================================
	// Save project to public.mockup_projects
	// =========================================
	async function saveMockup() {
		if (!mockupName.trim()) {
			toast.error('Please enter a mockup name');
			return;
		}
		isSaving = true;
		try {
			const { data: userData } = await supabase.auth.getUser();
			const userId = userData?.user?.id ?? null;

			saveCurrentViewState();
			const timestamp = Date.now();
			const safeName = mockupName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'mockup';

			let thumbnailUrl: string | null = null;
			const renderedUrls: Record<MockupViewType, string | null> = { front: null, back: null, side: null };

			for (const view of ALL_VIEWS) {
				if (hasBackgroundInView(view) && hasDesignsInView(view)) {
					const dataUrl = await exportView(view);
					if (dataUrl) {
						const url = await uploadDataUrlToMediaLibrary(dataUrl, `${safeName}-${view}-${timestamp}.png`);
						renderedUrls[view] = url;
						if (!thumbnailUrl) thumbnailUrl = url;
					}
				}
			}

			// Fall back to the raw background image if a view has no rendered design.
			for (const view of ALL_VIEWS) {
				if (!renderedUrls[view] && views[view].background_url) {
					renderedUrls[view] = views[view].background_url;
					if (!thumbnailUrl) thumbnailUrl = views[view].background_url;
				}
			}

			const row = {
				name: mockupName,
				views,
				front_image_url: renderedUrls.front,
				back_image_url: renderedUrls.back,
				side_image_url: renderedUrls.side,
				thumbnail_url: thumbnailUrl,
				created_by: userId
			};

			if (mockupToEdit) {
				const { error } = await supabase
					.from('mockup_projects')
					.update(row)
					.eq('id', mockupToEdit.id);
				if (error) throw error;
				toast.success('Mockup updated');
			} else {
				const { error } = await supabase.from('mockup_projects').insert(row);
				if (error) throw error;
				toast.success('Mockup saved');
			}

			hasUnsavedChanges = false;
			oncomplete();
		} catch (err) {
			console.error('Save error:', err);
			toast.error('Failed to save mockup');
		} finally {
			isSaving = false;
		}
	}

	// =========================================
	// Lifecycle
	// =========================================
	onMount(() => {
		initialize();
		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		if (fabricCanvas) fabricCanvas.dispose();
	});

	$effect(() => {
		if (canvasElement && !fabricCanvas) initCanvas();
	});

	$effect(() => {
		const _ = perspectiveGrid;
		if (fabricCanvas) fabricCanvas.renderAll();
	});
</script>

<div class="flex h-full flex-col bg-slate-950 text-slate-100">
	<!-- Header -->
	<div
		class="flex flex-col gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				class="inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
				onclick={oncomplete}
			>
				<ArrowLeft class="h-4 w-4" />
				Library
			</button>
			<div class="flex items-center gap-2">
				<label for="mockup-name" class="text-sm text-slate-400">Name</label>
				<input
					id="mockup-name"
					class="w-48 border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-accent-primary focus:outline-none sm:w-64"
					placeholder="Mockup name…"
					bind:value={mockupName}
				/>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if hasUnsavedChanges}
				<span class="text-xs text-amber-400">Unsaved changes</span>
			{/if}
			<button
				type="button"
				class="inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
				onclick={() => (isExportDialogOpen = true)}
			>
				<Download class="h-4 w-4" />
				Export
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:opacity-60"
				onclick={saveMockup}
				disabled={isSaving || !mockupName.trim()}
			>
				{#if isSaving}
					<Loader2 class="h-4 w-4 animate-spin" /> Saving…
				{:else}
					<Save class="h-4 w-4" /> Save Mockup
				{/if}
			</button>
		</div>
	</div>

	<!-- Main: canvas + design panel; stacks on mobile -->
	<div class="flex flex-1 flex-col overflow-hidden lg:flex-row">
		<!-- Canvas area -->
		<div class="flex flex-1 flex-col overflow-hidden bg-slate-950">
			<!-- View tabs + background controls + zoom -->
			<div
				class="flex flex-col gap-2 border-b border-slate-800 bg-slate-900/50 px-4 py-2 lg:flex-row lg:items-center lg:justify-between"
			>
				<div class="flex flex-wrap items-center gap-2">
					{#each ALL_VIEWS as view}
						<button
							type="button"
							class="relative inline-flex items-center gap-1 border px-3 py-1.5 text-sm transition {currentView ===
							view
								? 'border-accent-primary bg-accent-primary text-slate-950'
								: 'border-slate-700 bg-slate-800 text-slate-300 hover:text-accent-primary'}"
							onclick={() => switchView(view)}
						>
							{view.charAt(0).toUpperCase() + view.slice(1)}
							{#if hasDesignsInView(view)}
								<span class="absolute -right-1 -top-1 h-2 w-2 bg-accent-primary"></span>
							{/if}
						</button>
					{/each}

					<div class="hidden h-6 w-px bg-slate-700 lg:block"></div>

					<!-- Background source controls (REWORK) -->
					<button
						type="button"
						class="inline-flex items-center gap-1.5 border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 transition hover:text-accent-primary disabled:opacity-60"
						onclick={() => bgFileInput?.click()}
						disabled={isUploading}
						title="Upload background from device"
					>
						<Upload class="h-3.5 w-3.5" /> Background
					</button>
					<button
						type="button"
						class="inline-flex items-center gap-1.5 border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 transition hover:text-accent-primary"
						onclick={() => (bgPickerOpen = true)}
						title="Pick background from Media Library"
					>
						<ImageIcon class="h-3.5 w-3.5" /> Library
					</button>

					<!-- Perspective controls (side view only) -->
					{#if currentView === 'side'}
						<div class="hidden h-6 w-px bg-slate-700 lg:block"></div>
						<div class="flex items-center gap-1">
							<span class="mr-1 text-xs text-slate-500">Perspective:</span>
							<button
								type="button"
								class="inline-flex items-center gap-1 px-2 py-1 text-xs transition {perspectiveGrid ===
								'left'
									? 'bg-accent-primary/20 text-accent-primary'
									: 'text-slate-400 hover:text-slate-200'}"
								title="Left 45° perspective grid"
								onclick={() => (perspectiveGrid = perspectiveGrid === 'left' ? null : 'left')}
							>
								<Grid3x3 class="h-4 w-4" /> L45
							</button>
							<button
								type="button"
								class="inline-flex items-center gap-1 px-2 py-1 text-xs transition {perspectiveGrid ===
								'right'
									? 'bg-accent-primary/20 text-accent-primary'
									: 'text-slate-400 hover:text-slate-200'}"
								title="Right 45° perspective grid"
								onclick={() => (perspectiveGrid = perspectiveGrid === 'right' ? null : 'right')}
							>
								<Grid3x3 class="h-4 w-4" /> R45
							</button>
							<button
								type="button"
								class="inline-flex items-center gap-1 px-2 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 {perspectiveGrid
									? 'bg-accent-primary/30 text-accent-primary hover:bg-accent-primary/50'
									: 'text-slate-400'}"
								title="Apply perspective skew to selected design"
								onclick={applyPerspectiveSkew}
								disabled={!selectedObject || !perspectiveGrid}
							>
								<Sliders class="h-4 w-4" /> Apply
							</button>
						</div>
					{/if}
				</div>

				<!-- Zoom -->
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary"
						onclick={() => handleZoom(-0.1)}
						aria-label="Zoom out"
					>
						<ZoomOut class="h-4 w-4" />
					</button>
					<span class="w-12 text-center text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary"
						onclick={() => handleZoom(0.1)}
						aria-label="Zoom in"
					>
						<ZoomIn class="h-4 w-4" />
					</button>
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary"
						onclick={resetZoom}
						aria-label="Reset zoom"
					>
						<RotateCcw class="h-4 w-4" />
					</button>
				</div>
			</div>

			<!-- Canvas -->
			<div class="flex flex-1 items-center justify-center overflow-auto p-4">
				{#if canEdit}
					<div
						bind:this={canvasContainer}
						class="border-2 border-slate-700 shadow-2xl"
						style="transform-origin: center; transform: scale({zoom});"
					>
						<canvas bind:this={canvasElement}></canvas>
					</div>
				{:else}
					<!-- Keep canvas mounted (hidden) so fabric initializes; show prompt -->
					<div class="hidden">
						<div bind:this={canvasContainer}><canvas bind:this={canvasElement}></canvas></div>
					</div>
					<div class="max-w-sm text-center text-slate-500">
						<ImagePlus class="mx-auto mb-4 h-16 w-16" />
						<p class="text-lg text-slate-300">No background for the {currentView} view</p>
						<p class="mb-4 text-sm">Upload a background image or pick one from the Media Library.</p>
						<div class="flex flex-wrap justify-center gap-2">
							<button
								type="button"
								class="inline-flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:opacity-60"
								onclick={() => bgFileInput?.click()}
								disabled={isUploading}
							>
								<Upload class="h-4 w-4" /> Upload
							</button>
							<button
								type="button"
								class="inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
								onclick={() => (bgPickerOpen = true)}
							>
								<ImageIcon class="h-4 w-4" /> Media Library
							</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Canvas toolbar -->
			{#if canEdit}
				<div
					class="flex flex-wrap items-center justify-center gap-2 border-t border-slate-800 bg-slate-900/50 px-4 py-2"
				>
					<button
						type="button"
						class="inline-flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary disabled:opacity-50"
						onclick={deleteSelected}
						disabled={!selectedObject}
						title="Delete selected (Del)"
					>
						<Trash2 class="h-4 w-4" />
					</button>
					<div class="h-6 w-px bg-slate-700"></div>
					<button
						type="button"
						class="inline-flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary disabled:opacity-50"
						onclick={bringForward}
						disabled={!selectedObject}
						title="Bring forward"
					>
						<ArrowUp class="h-4 w-4" />
					</button>
					<button
						type="button"
						class="inline-flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary disabled:opacity-50"
						onclick={sendBackward}
						disabled={!selectedObject}
						title="Send backward"
					>
						<ArrowDown class="h-4 w-4" />
					</button>
					<div class="h-6 w-px bg-slate-700"></div>
					<button
						type="button"
						class="inline-flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary disabled:opacity-50"
						onclick={centerHorizontal}
						disabled={!selectedObject}
						title="Center horizontally"
					>
						<AlignCenterHorizontal class="h-4 w-4" />
					</button>
					<button
						type="button"
						class="inline-flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 transition hover:text-accent-primary disabled:opacity-50"
						onclick={centerVertical}
						disabled={!selectedObject}
						title="Center vertically"
					>
						<AlignCenterVertical class="h-4 w-4" />
					</button>
					<div class="h-6 w-px bg-slate-700"></div>
					<button
						type="button"
						class="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm transition {snapVertical
							? 'bg-accent-primary/20 text-accent-primary'
							: 'text-slate-400 hover:text-slate-200'}"
						title="Snap to vertical center"
						onclick={() => (snapVertical = !snapVertical)}
					>
						<SeparatorVertical class="h-4 w-4" /><span class="text-xs">V</span>
					</button>
					<button
						type="button"
						class="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm transition {snapHorizontal
							? 'bg-accent-primary/20 text-accent-primary'
							: 'text-slate-400 hover:text-slate-200'}"
						title="Snap to horizontal center"
						onclick={() => (snapHorizontal = !snapHorizontal)}
					>
						<SeparatorHorizontal class="h-4 w-4" /><span class="text-xs">H</span>
					</button>
				</div>
			{/if}
		</div>

		<!-- Design panel (REWORK: upload / Media Library only) -->
		<div
			class="w-full flex-shrink-0 border-t border-slate-800 bg-slate-900/50 p-4 lg:max-h-none lg:w-72 lg:border-l lg:border-t-0"
		>
			<h3 class="mb-1 text-sm font-semibold text-white">Add a design</h3>
			<p class="mb-3 text-xs text-slate-500">One design per view. Adding replaces the current one.</p>

			<div class="space-y-2">
				<button
					type="button"
					class="inline-flex w-full items-center justify-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:opacity-60"
					onclick={() => designFileInput?.click()}
					disabled={!canEdit || isUploading}
					title={!canEdit ? 'Add a background first' : 'Upload a design from your device'}
				>
					{#if isUploading}
						<Loader2 class="h-4 w-4 animate-spin" /> Uploading…
					{:else}
						<Upload class="h-4 w-4" /> Upload design
					{/if}
				</button>
				<button
					type="button"
					class="inline-flex w-full items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:text-accent-primary disabled:opacity-60"
					onclick={() => (designPickerOpen = true)}
					disabled={!canEdit}
					title={!canEdit ? 'Add a background first' : 'Pick a design from the Media Library'}
				>
					<ImageIcon class="h-4 w-4" /> Media Library
				</button>
			</div>

			{#if !canEdit}
				<p class="mt-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
					Add a background to the <strong>{currentView}</strong> view before placing a design.
				</p>
			{/if}

			{#if hasDesignsInView(currentView)}
				<div class="mt-4 border border-slate-800 bg-slate-900 p-3">
					<p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Current design</p>
					<p class="mt-1 truncate text-sm text-slate-200">
						{views[currentView].placements[0].designName || 'Design'}
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Hidden file inputs -->
<input
	bind:this={bgFileInput}
	type="file"
	accept="image/png,image/jpeg,image/webp,image/avif"
	class="hidden"
	onchange={handleBgFile}
/>
<input
	bind:this={designFileInput}
	type="file"
	accept="image/png,image/jpeg,image/webp,image/avif"
	class="hidden"
	onchange={handleDesignFile}
/>

<!-- Media Library pickers -->
<MediaPickerDialog
	{supabase}
	bind:open={bgPickerOpen}
	title="Pick a background"
	onpick={onBgPicked}
	onclose={() => (bgPickerOpen = false)}
/>
<MediaPickerDialog
	{supabase}
	bind:open={designPickerOpen}
	title="Pick a design"
	onpick={onDesignPicked}
	onclose={() => (designPickerOpen = false)}
/>

<!-- Export dialog (native modal) -->
{#if isExportDialogOpen}
	<div
		role="presentation"
		class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) isExportDialogOpen = false;
		}}
	>
		<div class="w-full max-w-md border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl">
			<h2 class="text-lg font-bold text-white">Export Mockup</h2>
			<p class="mt-0.5 text-sm text-slate-400">Choose which views to export.</p>

			<div class="mt-4 space-y-3">
				{#each ALL_VIEWS as view}
					{@const ready = hasBackgroundInView(view) && hasDesignsInView(view)}
					<label class="flex items-center gap-3">
						<input
							type="checkbox"
							bind:checked={exportOptions[view]}
							disabled={!ready}
							class="h-4 w-4 accent-accent-primary"
						/>
						<span class="text-sm {ready ? 'text-slate-200' : 'text-slate-500'}">
							{view.charAt(0).toUpperCase() + view.slice(1)} View
							{#if !ready}<span class="text-xs">(needs background + design)</span>{/if}
						</span>
					</label>
				{/each}

				<div class="border-t border-slate-800 pt-3">
					<label class="flex items-center gap-3">
						<input type="checkbox" bind:checked={exportOptions.strip} class="h-4 w-4 accent-accent-primary" />
						<span class="text-sm text-slate-200">Combined strip (all views + metadata bar)</span>
					</label>
				</div>

				<div class="border-t border-slate-800 pt-3">
					<label class="flex items-start gap-3">
						<input
							type="checkbox"
							bind:checked={exportOptions.saveToLibrary}
							class="mt-0.5 h-4 w-4 accent-accent-primary"
						/>
						<span>
							<span class="text-sm text-accent-primary">Also save to Media Library</span>
							<p class="text-xs text-slate-500">Uploads copies to the mockups/ folder.</p>
						</span>
					</label>
				</div>
			</div>

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					class="inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
					onclick={() => (isExportDialogOpen = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:opacity-60"
					onclick={handleExport}
					disabled={isExporting}
				>
					{#if isExporting}
						<Loader2 class="h-4 w-4 animate-spin" /> Exporting…
					{:else}
						<Download class="h-4 w-4" /> Export
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Replace-design confirmation (native modal) -->
{#if isReplaceDialogOpen}
	<div
		role="presentation"
		class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				isReplaceDialogOpen = false;
				pendingDesign = null;
			}
		}}
	>
		<div class="w-full max-w-sm border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl">
			<h2 class="text-lg font-bold text-white">Replace design</h2>
			<p class="mt-1 text-sm text-slate-300">
				This view already has a design. Replacing it resets position, rotation, and scale.
			</p>
			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					class="inline-flex items-center gap-2 border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:text-accent-primary"
					onclick={() => {
						isReplaceDialogOpen = false;
						pendingDesign = null;
					}}
				>
					Cancel
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-2 bg-accent-primary px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90"
					onclick={confirmReplaceDesign}
				>
					Replace
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.canvas-container) {
		background: transparent !important;
	}
</style>

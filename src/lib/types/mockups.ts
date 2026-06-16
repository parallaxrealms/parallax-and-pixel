// Mockup creator types — ported from 9realms VULCAN, reworked for Parallax & Pixel.
//
// PxP has no product catalog and no `designs` table. Backgrounds and designs both
// come from the Media Library (`media_assets` / `media_library` bucket) or from a
// device upload. Each view therefore stores its own `background_url` (replacing the
// SS Activewear catalog/variant image columns from 9realms).

export type MockupViewType = 'front' | 'back' | 'side';

/** A single design image placed on a view's canvas. */
export interface DesignPlacement {
	id: string;
	/** Source URL of the design image (Media Library public URL or uploaded). */
	imageUrl: string;
	/** Human label for the design (filename or media title). */
	designName: string;
	position: { x: number; y: number };
	scale: number;
	rotation: number;
	width: number;
	height: number;
	skewY?: number;
}

/** Per-view state: the background image plus its (single) design placement. */
export interface MockupViewState {
	/** Background image URL for this view (Media Library public URL or uploaded). */
	background_url: string | null;
	/** Design placements on this view. The creator enforces one design per view. */
	placements: DesignPlacement[];
}

export interface MockupViews {
	front: MockupViewState;
	back: MockupViewState;
	side: MockupViewState;
}

/** Row shape of public.mockup_projects (migration 008). */
export interface MockupProject {
	id: string;
	name: string;
	views: MockupViews;
	front_image_url: string | null;
	back_image_url: string | null;
	side_image_url: string | null;
	strip_image_url: string | null;
	thumbnail_url: string | null;
	sort_order?: number | null;
	created_at: string;
	updated_at: string;
	created_by: string | null;
}

export function emptyViews(): MockupViews {
	return {
		front: { background_url: null, placements: [] },
		back: { background_url: null, placements: [] },
		side: { background_url: null, placements: [] }
	};
}

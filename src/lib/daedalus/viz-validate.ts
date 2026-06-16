// DAEDALUS viz worthiness + numeric-grounding validators.
//
// These are the authoritative, server-side enforcement of the standing rule
// ("a viz must reveal real trend/distribution/composition — never a degenerate
// single-bar or decorative chart") plus the fabrication guard ("only chart
// numbers that actually appear in the entry/source"). They are PURE functions
// over a SceneDoc — no I/O, no model judgment — so the scenes endpoint can run
// them as a hard gate the client cannot bypass.
//
// Three exports:
//   validateVizWorthiness(doc)            → structural worthiness (degenerate reject)
//   extractSceneNumbers(doc)              → every charted numeric literal
//   validateNumericGrounding(doc, source) → fabrication guard (numbers must be sourced)

import type { SceneDoc, VizData } from './schema';

// ── tuning constants ──────────────────────────────────────────────────────────

/** Min labeled categories for bar/pie. */
const MIN_CATEGORIES = 3;
/** A pie is degenerate if one slice is ≥ this share of the whole. */
const MAX_PIE_SLICE_SHARE = 0.95;
/** Min points per series for line/area/scatter. */
const MIN_SERIES_POINTS = 3;
/** Min axes for a radar. */
const MIN_RADAR_AXES = 3;
/** Min rows / columns for a table. */
const MIN_TABLE_ROWS = 2;
const MIN_TABLE_COLS = 2;
/**
 * Low-variance floor: if the spread of comparable values is within this fraction
 * of their magnitude, the chart reveals nothing and is rejected. ~5%.
 */
const LOW_VARIANCE_FRACTION = 0.05;
/** Absolute float tolerance for grounding equality after normalization. */
const GROUNDING_TOLERANCE = 1e-6;
/** Relative float tolerance for grounding equality (handles rounding in prose). */
const GROUNDING_REL_TOLERANCE = 0.005;

export interface WorthinessResult {
	ok: boolean;
	reason?: string;
}

export interface GroundingResult {
	ok: boolean;
	/** Scene numbers that could not be found in the source text. */
	ungrounded: number[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

function isFiniteNum(v: unknown): v is number {
	return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Reject when every value sits within LOW_VARIANCE_FRACTION of the others — a
 * flat chart reveals nothing. Uses spread relative to max magnitude so it works
 * for both small and large scales. <2 values can't be "flat" — caller handles
 * the count floor separately.
 */
function isLowVariance(values: number[]): boolean {
	const nums = values.filter(isFiniteNum);
	if (nums.length < 2) return false;
	const min = Math.min(...nums);
	const max = Math.max(...nums);
	const spread = max - min;
	if (spread === 0) return true; // all identical
	const scale = Math.max(Math.abs(max), Math.abs(min));
	if (scale === 0) return false;
	return spread / scale <= LOW_VARIANCE_FRACTION;
}

// ── 1. worthiness ──────────────────────────────────────────────────────────────

/**
 * Pure structural worthiness check. Rejects degenerate scenes regardless of the
 * authoring model's judgment. Returns `{ ok:true }` for any primitive without a
 * specific degeneracy rule (e.g. graph/tree/heatmap/etc.) — those carry their own
 * shape constraints elsewhere and are not part of the Mimir-inline guardrail.
 */
export function validateVizWorthiness(doc: SceneDoc): WorthinessResult {
	const d: VizData = doc?.data ?? {};
	const p = doc?.primitive;

	switch (p) {
		case 'bar':
		case 'pie': {
			const cats = d.categories ?? [];
			if (cats.length < MIN_CATEGORIES) {
				return { ok: false, reason: `${p} needs ≥${MIN_CATEGORIES} categories (got ${cats.length})` };
			}
			const values = cats.map((c) => c.value).filter(isFiniteNum);
			if (p === 'pie') {
				const total = values.reduce((s, v) => s + v, 0);
				if (total > 0) {
					const maxShare = Math.max(...values) / total;
					if (maxShare >= MAX_PIE_SLICE_SHARE) {
						return {
							ok: false,
							reason: `pie has a slice that is ${Math.round(maxShare * 100)}% of the whole (≥${Math.round(MAX_PIE_SLICE_SHARE * 100)}%)`
						};
					}
				}
			}
			if (isLowVariance(values)) {
				return { ok: false, reason: `${p} category values are within ~${Math.round(LOW_VARIANCE_FRACTION * 100)}% of each other (no real distribution)` };
			}
			return { ok: true };
		}

		case 'line':
		case 'area':
		case 'scatter': {
			const series = d.series ?? [];
			if (series.length === 0) return { ok: false, reason: `${p} has no series` };
			// Each series needs enough points; reject if the richest series is too short.
			const maxPoints = Math.max(...series.map((s) => (s.points ?? []).length));
			if (maxPoints < MIN_SERIES_POINTS) {
				return { ok: false, reason: `${p} needs ≥${MIN_SERIES_POINTS} points (richest series has ${maxPoints})` };
			}
			// Low-variance floor on the y-values of every series (flat lines reveal nothing).
			for (const s of series) {
				const ys = (s.points ?? []).map((pt) => pt.y).filter(isFiniteNum);
				if (ys.length >= MIN_SERIES_POINTS && isLowVariance(ys)) {
					return { ok: false, reason: `${p} series "${s.name ?? s.id}" is flat (y-values within ~${Math.round(LOW_VARIANCE_FRACTION * 100)}%)` };
				}
			}
			return { ok: true };
		}

		case 'gauge':
		case 'bullet': {
			const sc = d.scalar;
			if (!sc) return { ok: false, reason: `${p} has no scalar` };
			if (!isFiniteNum(sc.min) || !isFiniteNum(sc.max)) {
				return { ok: false, reason: `${p} requires numeric min and max` };
			}
			if (p === 'bullet' && !isFiniteNum(sc.target)) {
				return { ok: false, reason: 'bullet requires a numeric target' };
			}
			const thresholds = sc.thresholds ?? [];
			if (thresholds.length === 0) {
				return { ok: false, reason: `${p} requires thresholds` };
			}
			return { ok: true };
		}

		case 'table': {
			const t = d.tabular;
			if (!t) return { ok: false, reason: 'table has no tabular data' };
			const rows = t.rows ?? [];
			const cols = t.columns ?? [];
			if (rows.length < MIN_TABLE_ROWS) {
				return { ok: false, reason: `table needs ≥${MIN_TABLE_ROWS} rows (got ${rows.length})` };
			}
			if (cols.length < MIN_TABLE_COLS) {
				return { ok: false, reason: `table needs ≥${MIN_TABLE_COLS} columns (got ${cols.length})` };
			}
			return { ok: true };
		}

		case 'radar': {
			const r = d.radar;
			if (!r) return { ok: false, reason: 'radar has no radar data' };
			const axes = r.axes ?? [];
			if (axes.length < MIN_RADAR_AXES) {
				return { ok: false, reason: `radar needs ≥${MIN_RADAR_AXES} axes (got ${axes.length})` };
			}
			return { ok: true };
		}

		default:
			// Other primitives (stat/graph/tree/heatmap/sankey/timeline/treemap/stack)
			// carry no Mimir-inline degeneracy rule — accept structurally.
			return { ok: true };
	}
}

// ── 2. extract charted numbers ──────────────────────────────────────────────────

/**
 * Every charted numeric literal in the scene, in document order:
 *   - categories[].value
 *   - series[].points[].y (and numeric x)
 *   - scalar value/min/max/target, thresholds[].at, spark[]
 *   - radar series values[] and radar.max
 *   - tabular numeric cell values
 *   - matrix values (heatmap) and thresholds
 * Non-finite values are skipped. This is the set the grounding guard checks.
 */
export function extractSceneNumbers(doc: SceneDoc): number[] {
	const d: VizData = doc?.data ?? {};
	const out: number[] = [];
	const push = (v: unknown) => {
		if (isFiniteNum(v)) out.push(v);
	};

	// categories (bar/pie)
	for (const c of d.categories ?? []) push(c.value);

	// series (line/area/scatter/grouped bar)
	for (const s of d.series ?? []) {
		for (const pt of s.points ?? []) {
			if (isFiniteNum(pt.x)) push(pt.x);
			push(pt.y);
		}
	}

	// scalar (stat/gauge/bullet)
	const sc = d.scalar;
	if (sc) {
		push(sc.value);
		push(sc.min);
		push(sc.max);
		push(sc.target);
		for (const th of sc.thresholds ?? []) push(th.at);
		for (const v of sc.spark ?? []) push(v);
	}

	// radar
	if (d.radar) {
		push(d.radar.max);
		for (const rs of d.radar.series ?? []) for (const v of rs.values ?? []) push(v);
	}

	// tabular numeric cells
	if (d.tabular) {
		for (const row of d.tabular.rows ?? []) {
			for (const val of Object.values(row)) {
				if (isFiniteNum(val)) push(val);
				else if (Array.isArray(val)) for (const v of val) push(v); // sparkline arrays
			}
		}
	}

	// matrix (heatmap)
	if (d.matrix) {
		for (const rowVals of d.matrix.values ?? []) for (const v of rowVals) push(v);
		for (const th of d.matrix.thresholds ?? []) push(th.at);
	}

	return out;
}

// ── 3. numeric grounding (fabrication guard) ────────────────────────────────────

/**
 * Parse a multiset of numbers out of free source text. Normalizes by stripping
 * thousands-separator commas, percent/currency/unit suffixes, and collapsing
 * whitespace, then matching standard/decimal/signed numeric literals.
 *
 * Returns the list (with multiplicity) of numbers the source text mentions.
 */
function sourceNumbers(sourceText: string): number[] {
	if (typeof sourceText !== 'string' || sourceText.length === 0) return [];
	// Strip currency symbols and the thousands commas inside numbers ("1,234.5" → "1234.5"),
	// then collapse whitespace. Percent/unit suffixes don't break the numeric match below,
	// so we leave them — the regex picks the number off the front.
	const normalized = sourceText
		.replace(/[$£€¥]/g, ' ')
		.replace(/(\d),(?=\d{3}\b)/g, '$1') // remove grouping commas only
		.replace(/\s+/g, ' ');

	const nums: number[] = [];
	// Match signed decimals/integers, incl. leading-dot decimals (.5) and scientific.
	const re = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(normalized)) !== null) {
		const n = Number(m[0]);
		if (Number.isFinite(n)) nums.push(n);
	}
	return nums;
}

/** True when `target` matches `candidate` within absolute or relative tolerance. */
function numbersClose(target: number, candidate: number): boolean {
	const diff = Math.abs(target - candidate);
	if (diff <= GROUNDING_TOLERANCE) return true;
	const scale = Math.max(Math.abs(target), Math.abs(candidate));
	return scale > 0 && diff / scale <= GROUNDING_REL_TOLERANCE;
}

/**
 * Fabrication guard: every number the scene charts MUST appear in the source
 * text (the entry body + cited sources), within a small float tolerance. Any
 * scene number with no match in the source is "ungrounded" — likely fabricated.
 *
 * Matching is a multiset consume: each source number can ground at most one
 * scene number, so a chart claiming "10, 10, 10" must find three 10s in the
 * source. Returns `{ ok:false, ungrounded:[...] }` listing the unmatched values.
 */
export function validateNumericGrounding(doc: SceneDoc, sourceText: string): GroundingResult {
	const sceneNums = extractSceneNumbers(doc);
	const pool = sourceNumbers(sourceText);
	const consumed = new Array<boolean>(pool.length).fill(false);
	const ungrounded: number[] = [];

	for (const target of sceneNums) {
		let matched = false;
		for (let i = 0; i < pool.length; i++) {
			if (consumed[i]) continue;
			if (numbersClose(target, pool[i])) {
				consumed[i] = true;
				matched = true;
				break;
			}
		}
		if (!matched) ungrounded.push(target);
	}

	return { ok: ungrounded.length === 0, ungrounded };
}

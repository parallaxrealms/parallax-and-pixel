// Shared helpers for the native-SVG chart primitives (Stat, Gauge, Bar, Pie, …).
// No charting dependency — we draw SVG ourselves for full theme control and
// faithful PNG export. Charts author colors/fonts as inline attributes so the
// serialized SVG renders identically off-DOM during export.
import type { VizCategory, VizScalar } from './schema';

/** Themed categorical palette — cobalt-led, balanced for dark backgrounds. */
export const CHART_PALETTE = [
	'#4d7cff', // cobalt (daedalus accent)
	'#14b8a6', // teal
	'#f5a623', // amber
	'#a855f7', // violet
	'#f43f5e', // rose
	'#38bdf8', // cyan
	'#84cc16', // lime
	'#fb923c', // orange
	'#e879f9', // fuchsia
	'#2dd4bf' // aqua
] as const;

export function categoryColor(cat: Pick<VizCategory, 'color'>, i: number): string {
	return cat.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
}

/** Resolve the active color for a scalar from its ascending threshold bands. */
export function scalarColor(scalar: VizScalar, fallback = '#4d7cff'): string {
	const t = scalar.thresholds;
	if (!t || t.length === 0) return fallback;
	const sorted = [...t].sort((a, b) => a.at - b.at);
	let color = fallback;
	for (const band of sorted) {
		if (scalar.value >= band.at) color = band.color;
	}
	return color;
}

/** Clamp a value into [min,max] and return its 0..1 fraction of the range. */
export function rangeFraction(value: number, min = 0, max = 100): number {
	if (max === min) return 0;
	return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Format a number compactly (1_500 → "1.5K", 2_000_000 → "2M"). */
export function formatNumber(n: number): string {
	const abs = Math.abs(n);
	if (abs >= 1e9) return trim(n / 1e9) + 'B';
	if (abs >= 1e6) return trim(n / 1e6) + 'M';
	if (abs >= 1e3) return trim(n / 1e3) + 'K';
	if (Number.isInteger(n)) return String(n);
	return trim(n);
}

function trim(n: number): string {
	return String(Math.round(n * 10) / 10);
}

export function seriesColor(s: { color?: string }, i: number): string {
	return s.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
}

/** Round a number to a "nice" value (1, 2, 5 × 10^n) for axis ticks. */
function niceNum(range: number, round: boolean): number {
	if (range === 0) return 1;
	const exp = Math.floor(Math.log10(range));
	const frac = range / Math.pow(10, exp);
	let niceFrac: number;
	if (round) {
		niceFrac = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
	} else {
		niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
	}
	return niceFrac * Math.pow(10, exp);
}

/** Produce ~count evenly-spaced "nice" tick values spanning [min,max]. */
export function axisTicks(min: number, max: number, count = 5): number[] {
	if (min === max) {
		max = min + 1;
		min = min - 1;
	}
	const range = niceNum(max - min, false);
	const step = niceNum(range / (count - 1), true);
	const niceMin = Math.floor(min / step) * step;
	const niceMax = Math.ceil(max / step) * step;
	const ticks: number[] = [];
	for (let v = niceMin; v <= niceMax + step / 2; v += step) {
		ticks.push(Math.round(v * 1e6) / 1e6);
	}
	return ticks;
}

/** SVG polyline path for a tiny inline sparkline within a w×h box. */
export function sparklinePath(values: number[], w: number, h: number, pad = 1): string {
	if (!values || values.length < 2) return '';
	const lo = Math.min(...values);
	const hi = Math.max(...values);
	const span = hi - lo || 1;
	const step = (w - pad * 2) / (values.length - 1);
	return values
		.map((v, i) => {
			const x = pad + i * step;
			const y = pad + (h - pad * 2) * (1 - (v - lo) / span);
			return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
		})
		.join(' ');
}

export const CONTENT_FONT: Record<string, string> = {
	sans: "'Inter', system-ui, -apple-system, sans-serif",
	mono: "'JetBrains Mono', ui-monospace, monospace",
	serif: "'Georgia', 'Times New Roman', serif"
};

/**
 * Rasterize a live <svg> to a PNG data URL by serializing + drawing to a
 * canvas. Charts must use inline presentation attributes (fill/font-family)
 * so the off-DOM render matches what's on screen.
 */
export async function svgToPng(
	svg: SVGSVGElement,
	width: number,
	height: number,
	background = '#0b1020',
	scale = 2
): Promise<string> {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	clone.setAttribute('width', String(width));
	clone.setAttribute('height', String(height));
	if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
	const xml = new XMLSerializer().serializeToString(clone);
	const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
	const img = new Image();
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error('SVG rasterize failed'));
		img.src = src;
	});
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(width * scale);
	canvas.height = Math.round(height * scale);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D context unavailable');
	if (background) {
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL('image/png');
}

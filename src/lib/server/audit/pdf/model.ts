/**
 * Pure builder that turns a stored audit (scores + raw Signals + findings) into
 * the display-ready model the PDF report template consumes.
 *
 * No I/O. Keeps all the "raw signal -> human-friendly value" mapping in one
 * place so the Svelte template stays presentational.
 */

import type { QualityResult, Finding, Signals, FindingSeverity } from '../scoring/types';

export type Verdict = 'excellent' | 'good' | 'needs work' | 'urgent';

export interface VitalZone {
	/** zone label */
	label: string;
	/** flex-grow weight (proportional to Google's threshold split) */
	weight: number;
	/** tint class: ok | warn | bad */
	tone: 'ok' | 'warn' | 'bad';
}

export interface VitalBar {
	metric: string; // "LCP"
	name: string; // "Largest Contentful Paint"
	explainer: string;
	zones: VitalZone[];
	/** marker position 0..1 across the bar, or null if no measurement */
	markerPct: number | null;
	youLabel: string; // "you: 4.1s (needs work)" or "not measured"
	youTone: 'ok' | 'warn' | 'bad' | 'muted';
	ticks: string[];
}

export interface ChecklistRow {
	state: 'ok' | 'warn' | 'fail';
	name: string;
	status: string;
}

export interface FindingCard {
	severity: FindingSeverity;
	title: string;
	description: string;
	fix: string;
}

export interface PillarBar {
	key: 'performance' | 'ai_readiness' | 'seo';
	label: string;
	score: number;
	verdict: Verdict;
}

export interface ReportModel {
	auditId: string;
	auditIdShort: string;
	url: string;
	hostname: string;
	slug: string;
	dateIso: string; // 2026-05-23
	dateDotted: string; // 2026.05.23
	capturedUtc: string; // 2026-05-23 14:22:11 UTC
	scores: QualityResult;
	overallVerdict: Verdict;
	pillars: PillarBar[];
	summaryParagraph: string;
	topWins: string[];
	vitals: VitalBar[];
	aiChecklist: ChecklistRow[];
	seoChecklist: ChecklistRow[];
	perfFindings: FindingCard[];
	aiFindings: FindingCard[];
	seoFindings: FindingCard[];
	engineVersion: string;
	methodologyLines: string[];
	pageCount: number;
}

export function verdictFor(score: number): Verdict {
	if (score >= 90) return 'excellent';
	if (score >= 75) return 'good';
	if (score >= 50) return 'needs work';
	return 'urgent';
}

export function hostnameOf(u: string): string {
	try {
		return new URL(u).hostname.replace(/^www\./, '');
	} catch {
		return u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
	}
}

export function slugify(host: string): string {
	return host
		.toLowerCase()
		.replace(/\./g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 64);
}

/** Friendly download filename: pxp-audit_{slug}_{YYYY-MM-DD}.pdf */
export function pdfFilename(host: string, dateIso: string): string {
	return `pxp-audit_${slugify(host)}_${dateIso}.pdf`;
}

function fmtMs(ms: number | null): string {
	if (ms == null) return 'n/a';
	if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
	return `${Math.round(ms)}ms`;
}

// ── Core Web Vitals zone math ──────────────────────────────────────────
// Zone widths are proportional to Google's threshold split (not linear time)
// so each bucket reads at its real importance.

function lcpBar(lcpMs: number | null): VitalBar {
	// good 0–2.5s, needs 2.5–4.0s, poor 4.0–8s
	const scaleMax = 8000;
	const zones: VitalZone[] = [
		{ label: 'good', weight: 2500, tone: 'ok' },
		{ label: 'needs work', weight: 1500, tone: 'warn' },
		{ label: 'poor', weight: 4000, tone: 'bad' }
	];
	const markerPct = lcpMs == null ? null : Math.min(lcpMs / scaleMax, 1);
	const tone: VitalBar['youTone'] =
		lcpMs == null ? 'muted' : lcpMs <= 2500 ? 'ok' : lcpMs <= 4000 ? 'warn' : 'bad';
	return {
		metric: 'LCP',
		name: 'Largest Contentful Paint',
		explainer: 'How long until the biggest thing on screen shows up.',
		zones,
		markerPct,
		youLabel: lcpMs == null ? 'not measured' : `you: ${fmtMs(lcpMs)} (${verdictWord(tone)})`,
		youTone: tone,
		ticks: ['0s', '2.5s', '4.0s', '8s']
	};
}

function tbtBar(tbtMs: number | null): VitalBar {
	// TBT proxy for INP (PSI mobile reports TBT). good 0–200, needs 200–600, poor 600–1000+
	const scaleMax = 1000;
	const zones: VitalZone[] = [
		{ label: 'good', weight: 200, tone: 'ok' },
		{ label: 'needs work', weight: 400, tone: 'warn' },
		{ label: 'poor', weight: 400, tone: 'bad' }
	];
	const markerPct = tbtMs == null ? null : Math.min(tbtMs / scaleMax, 1);
	const tone: VitalBar['youTone'] =
		tbtMs == null ? 'muted' : tbtMs <= 200 ? 'ok' : tbtMs <= 600 ? 'warn' : 'bad';
	return {
		metric: 'TBT',
		name: 'Total Blocking Time',
		explainer: 'How long the page is frozen and cannot respond to taps.',
		zones,
		markerPct,
		youLabel: tbtMs == null ? 'not measured' : `you: ${fmtMs(tbtMs)} (${verdictWord(tone)})`,
		youTone: tone,
		ticks: ['0', '200ms', '600ms', '1000ms']
	};
}

function clsBar(cls: number | null): VitalBar {
	// good 0–0.1, needs 0.1–0.25, poor 0.25–1
	const scaleMax = 1;
	const zones: VitalZone[] = [
		{ label: 'good', weight: 0.1, tone: 'ok' },
		{ label: 'needs work', weight: 0.15, tone: 'warn' },
		{ label: 'poor', weight: 0.75, tone: 'bad' }
	];
	const markerPct = cls == null ? null : Math.min(cls / scaleMax, 1);
	const tone: VitalBar['youTone'] =
		cls == null ? 'muted' : cls <= 0.1 ? 'ok' : cls <= 0.25 ? 'warn' : 'bad';
	return {
		metric: 'CLS',
		name: 'Cumulative Layout Shift',
		explainer: 'How much things jump around as the page loads.',
		zones,
		markerPct,
		youLabel: cls == null ? 'not measured' : `you: ${cls.toFixed(2)} (${verdictWord(tone)})`,
		youTone: tone,
		ticks: ['0', '0.1', '0.25', '1']
	};
}

function verdictWord(tone: 'ok' | 'warn' | 'bad' | 'muted'): string {
	switch (tone) {
		case 'ok':
			return 'good';
		case 'warn':
			return 'needs work';
		case 'bad':
			return 'poor';
		default:
			return 'unknown';
	}
}

// ── Checklists ─────────────────────────────────────────────────────────

function aiChecklist(s: Signals | null): ChecklistRow[] {
	const ai = s?.ai_readiness;
	const rows: ChecklistRow[] = [];
	const ok = (b: boolean | undefined): 'ok' | 'fail' => (b ? 'ok' : 'fail');

	rows.push({
		state: ok(ai?.has_schema_ld),
		name: 'Schema.org JSON-LD',
		status: ai?.has_schema_ld
			? `${ai.schema_types?.length ? ai.schema_types.slice(0, 3).join(', ') : 'present'}`
			: 'Not found in page head'
	});
	rows.push({
		state: ok(ai?.has_opengraph),
		name: 'Open Graph tags',
		status: ai?.has_opengraph ? 'Title, description, image set' : 'Missing or incomplete'
	});
	rows.push({
		state: ok(ai?.llms_txt),
		name: 'llms.txt',
		status: ai?.llms_txt ? 'Present at /llms.txt' : 'Not found at /llms.txt'
	});
	rows.push({
		state: ok(ai?.has_twitter_card),
		name: 'Twitter Card',
		status: ai?.has_twitter_card ? 'summary_large_image set' : 'summary_large_image missing'
	});
	rows.push({
		state: ok(ai?.has_canonical),
		name: 'Canonical tag',
		status: ai?.has_canonical ? 'Present and self-referential' : 'Missing'
	});
	const semantic = ai?.semantic_html_ratio ?? 0;
	rows.push({
		state: semantic >= 0.4 ? 'ok' : semantic >= 0.2 ? 'warn' : 'fail',
		name: 'Semantic HTML',
		status: `Landmark ratio ${Math.round(semantic * 100)}%`
	});
	rows.push({
		state: ok(ai?.robots_txt),
		name: 'robots.txt',
		status: ai?.robots_txt ? 'Present, AI crawlers allowed' : 'Not found at /robots.txt'
	});
	rows.push({
		state: ai?.html_lang ? 'ok' : 'warn',
		name: 'Language declared',
		status: ai?.html_lang ? `lang="${ai.html_lang}"` : 'No html lang attribute'
	});
	return rows;
}

function seoChecklist(s: Signals | null): ChecklistRow[] {
	const ai = s?.ai_readiness;
	const content = s?.content;
	const stack = s?.stack;
	const rows: ChecklistRow[] = [];

	rows.push({
		state: ai?.sitemap_xml ? 'ok' : 'fail',
		name: 'sitemap.xml',
		status: ai?.sitemap_xml ? 'Present at /sitemap.xml' : 'Not found'
	});
	rows.push({
		state: ai?.robots_txt ? 'ok' : 'fail',
		name: 'robots.txt',
		status: ai?.robots_txt ? 'Present' : 'Not found'
	});
	const titleLen = content?.title_length ?? 0;
	rows.push({
		state: titleLen >= 30 && titleLen <= 60 ? 'ok' : titleLen > 0 ? 'warn' : 'fail',
		name: 'Title tag',
		status: titleLen > 0 ? `${titleLen} characters` : 'Missing'
	});
	const descLen = content?.description_length ?? 0;
	rows.push({
		state: descLen >= 70 && descLen <= 160 ? 'ok' : descLen > 0 ? 'warn' : 'fail',
		name: 'Meta description',
		status: descLen > 0 ? `${descLen} characters` : 'Missing'
	});
	const words = content?.word_count ?? 0;
	rows.push({
		state: words >= 300 ? 'ok' : words > 0 ? 'warn' : 'fail',
		name: 'Visible word count',
		status: words > 0 ? `${words} words on homepage` : 'Very thin content'
	});
	rows.push({
		state: ai?.has_canonical ? 'ok' : 'warn',
		name: 'Canonical tag',
		status: ai?.has_canonical ? 'Present' : 'Missing'
	});
	rows.push({
		state: stack?.has_cdn ? 'ok' : 'warn',
		name: 'CDN',
		status: stack?.has_cdn ? (stack.cdn_provider ?? 'Detected') : 'No CDN detected'
	});
	rows.push({
		state: s?.tls?.valid ? 'ok' : 'fail',
		name: 'HTTPS / TLS',
		status: s?.tls?.valid ? 'Valid certificate' : 'No valid certificate'
	});
	return rows;
}

// ── Plain-English summary ──────────────────────────────────────────────

function summaryParagraph(scores: QualityResult, host: string, s: Signals | null): string {
	const ordered = (
		[
			['page speed', scores.performance],
			['ai-readiness', scores.ai_readiness],
			['search visibility', scores.seo]
		] as const
	)
		.slice()
		.sort((a, b) => a[1] - b[1]);
	const weakest = ordered[0];
	const strongest = ordered[ordered.length - 1];

	const lcp = s?.lighthouse?.lcp_ms ?? null;
	const speedLine =
		lcp != null
			? ` Your homepage takes about ${fmtMs(lcp)} to show its main content on a phone.`
			: '';

	return (
		`${host} scores ${scores.overall} out of 100. ` +
		`The strongest area is ${strongest[0]} at ${strongest[1]}. ` +
		`The biggest opportunity is ${weakest[0]} at ${weakest[1]}.` +
		speedLine
	);
}

function topWins(findings: Finding[]): string[] {
	const sev = { critical: 0, warning: 1, info: 2 } as const;
	return [...findings]
		.sort((a, b) => (sev[a.severity] ?? 9) - (sev[b.severity] ?? 9))
		.slice(0, 3)
		.map((f) => f.title);
}

function toCards(findings: Finding[], pillar: Finding['pillar'], max = 3): FindingCard[] {
	const sev = { critical: 0, warning: 1, info: 2 } as const;
	return findings
		.filter((f) => f.pillar === pillar)
		.sort((a, b) => (sev[a.severity] ?? 9) - (sev[b.severity] ?? 9))
		.slice(0, max)
		.map((f) => ({
			severity: f.severity,
			title: f.title,
			description: f.description,
			fix: f.fix
		}));
}

export function buildReportModel(input: {
	auditId: string;
	url: string;
	scores: QualityResult;
	signals: Signals | null;
	findings: Finding[];
	createdAt: string;
}): ReportModel {
	const { auditId, url, scores, signals, findings, createdAt } = input;
	const host = hostnameOf(url);
	const d = new Date(createdAt);
	const dateIso = d.toISOString().slice(0, 10);
	const dateDotted = dateIso.replace(/-/g, '.');
	const capturedUtc = `${d.toISOString().slice(0, 19).replace('T', ' ')} UTC`;

	const lh = signals?.lighthouse ?? null;

	return {
		auditId,
		auditIdShort: auditId.slice(0, 8),
		url,
		hostname: host,
		slug: slugify(host),
		dateIso,
		dateDotted,
		capturedUtc,
		scores,
		overallVerdict: verdictFor(scores.overall),
		pillars: [
			{
				key: 'performance',
				label: 'performance',
				score: scores.performance,
				verdict: verdictFor(scores.performance)
			},
			{
				key: 'ai_readiness',
				label: 'ai-readiness',
				score: scores.ai_readiness,
				verdict: verdictFor(scores.ai_readiness)
			},
			{ key: 'seo', label: 'seo', score: scores.seo, verdict: verdictFor(scores.seo) }
		],
		summaryParagraph: summaryParagraph(scores, host, signals),
		topWins: topWins(findings),
		vitals: [lcpBar(lh?.lcp_ms ?? null), tbtBar(lh?.tbt_ms ?? null), clsBar(lh?.cls ?? null)],
		aiChecklist: aiChecklist(signals),
		seoChecklist: seoChecklist(signals),
		perfFindings: toCards(findings, 'performance'),
		aiFindings: toCards(findings, 'ai_readiness'),
		seoFindings: toCards(findings, 'seo'),
		engineVersion: scores.rubric_version,
		methodologyLines: [
			'Performance is measured with Google Lighthouse via PageSpeed Insights in mobile emulation.',
			'AI-readiness signals are checked against the public llms.txt spec and Schema.org 2026 vocabulary.',
			'SEO signals follow Google Search Central technical guidelines.'
		],
		pageCount: 6
	};
}

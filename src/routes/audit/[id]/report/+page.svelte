<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import type { ChecklistRow, VitalBar, FindingCard } from '$lib/server/audit/pdf/model';

	let { data }: { data: PageData } = $props();
	const m = $derived(data.model);

	const VERDICT_CLASS: Record<string, string> = {
		excellent: 'v-excellent',
		good: 'v-good',
		'needs work': 'v-needs',
		urgent: 'v-urgent'
	};

	// Signal Playwright (and humans) that fonts/layout are settled. The render
	// service also awaits document.fonts.ready; this is the belt-and-braces flag.
	onMount(() => {
		const ready = () => document.documentElement.setAttribute('data-report-ready', '1');
		const fonts = (document as Document).fonts;
		if (fonts && typeof fonts.ready?.then === 'function') {
			fonts.ready.then(ready);
		} else {
			ready();
		}
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex,nofollow" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700;800&family=Space+Mono:wght@400;700&display=swap"
	/>
</svelte:head>

<div class="report">
	<!-- ══ PAGE 1 // COVER ══════════════════════════════════════════════ -->
	<section class="page cover">
		<img class="cover-logo" src="/icon.webp" alt="Parallax & Pixel" />

		<div class="cover-mid">
			<div class="cover-kicker disp">SITE HEALTH AUDIT</div>
			<div class="cover-date disp">{m.dateDotted}</div>
			<div class="cover-host">{m.hostname}</div>
		</div>

		<div class="cover-hero">
			<div class="hero-score grad disp">{m.scores.overall}</div>
			<div class="hairline hero-rule"></div>
			<div class="hero-label disp">OVERALL <span class="of">/ 100</span></div>
			<div class="hero-verdict {VERDICT_CLASS[m.overallVerdict]} disp">{m.overallVerdict}</div>
		</div>

		<div class="cover-pillars">
			{#each m.pillars as p (p.key)}
				<div class="cp">
					<div class="cp-label disp">{p.label}</div>
					<div class="cp-score grad disp">{p.score}</div>
				</div>
			{/each}
		</div>

		<div class="hairline cover-foot-rule"></div>
		<div class="cover-foot">
			<div class="cover-foot-left">
				<div class="brandmark disp">Parallax & Pixel</div>
				<div class="faint">parallaxandpixel.com</div>
			</div>
			<div class="cover-foot-right faint">
				<div>audited by</div>
				<div>the PXP engine</div>
			</div>
		</div>
	</section>

	<!-- ══ PAGE 2 // EXECUTIVE SUMMARY ══════════════════════════════════ -->
	<section class="page">
		{@render pageHeader()}

		<h2 class="ptitle disp">Executive summary</h2>
		<div class="hairline title-rule"></div>

		<p class="body">{m.summaryParagraph}</p>

		{#if m.topWins.length}
			<p class="label">Top {m.topWins.length} wins (do these first)</p>
			<div class="wins">
				{#each m.topWins as win, i (win)}
					<div class="win">
						<span class="win-idx disp">{String(i + 1).padStart(2, '0')}</span>
						<span class="body">{win}</span>
					</div>
				{/each}
			</div>
		{/if}

		<div class="hairline section-rule"></div>
		<p class="label">Pillar scores</p>

		<div class="pbars">
			{#each m.pillars as p (p.key)}
				<div class="pbar">
					<div class="pbar-head">
						<span class="pbar-name disp">{p.label}</span>
						<span class="pbar-score disp">{p.score} <span class="of">/ 100</span></span>
					</div>
					<div class="bar-track">
						<div class="bar-fill" style="width:{p.score}%"></div>
					</div>
					<div class="pbar-verdict {VERDICT_CLASS[p.verdict]} label">{p.verdict}</div>
				</div>
			{/each}
		</div>

		<p class="methodology-foot faint">
			Scored with the PXP quality rubric <span class="slash">//</span> {m.engineVersion}
		</p>

		{@render footer(2)}
	</section>

	<!-- ══ PAGE 3 // PERFORMANCE ════════════════════════════════════════ -->
	<section class="page">
		{@render pageHeader()}
		{@render pillarHead('01', 'Performance', m.scores.performance)}

		<p class="framing">How fast your site loads on a real phone, on a real network. We measure what Google measures.</p>

		<p class="label">Core web vitals</p>
		<div class="vitals">
			{#each m.vitals as v (v.metric)}
				{@render vital(v)}
			{/each}
		</div>

		<p class="label">Top performance findings</p>
		{@render findingList(m.perfFindings)}

		{@render footer(3)}
	</section>

	<!-- ══ PAGE 4 // AI-READINESS ═══════════════════════════════════════ -->
	<section class="page">
		{@render pageHeader()}
		{@render pillarHead('02', 'AI-readiness', m.scores.ai_readiness)}

		<p class="framing">
			In 2026, more than one in four product searches starts in an AI chat. Sites without
			structured data do not appear in those answers.
		</p>

		<p class="label">Readiness checklist</p>
		{@render checklist(m.aiChecklist)}

		<p class="label">Top AI findings</p>
		{@render findingList(m.aiFindings)}

		{@render footer(4)}
	</section>

	<!-- ══ PAGE 5 // SEO ════════════════════════════════════════════════ -->
	<section class="page">
		{@render pageHeader()}
		{@render pillarHead('03', 'SEO', m.scores.seo)}

		<p class="framing">Classic search still pays the bills. Here is what Google sees.</p>

		<p class="label">Technical checklist</p>
		{@render checklist(m.seoChecklist)}

		<p class="label">Top SEO findings</p>
		{@render findingList(m.seoFindings)}

		{@render footer(5)}
	</section>

	<!-- ══ PAGE 6 // WHAT'S NEXT + METHODOLOGY ══════════════════════════ -->
	<section class="page">
		{@render pageHeader()}

		<h2 class="ptitle disp">What's next</h2>
		<div class="hairline title-rule"></div>

		<p class="body">
			Everything in this report is standard web work. Each finding is written so a developer can
			act on it directly.
		</p>
		<p class="body">
			Prefer it handled for you? Parallax &amp; Pixel can take any of these on, end to end.
		</p>

		<div class="packs">
			<div class="pack">
				<div class="pack-name disp">Re-audit</div>
				<p class="pack-body">A fresh scan on a schedule, with the branded PDF and an alert if your score slips.</p>
				<div class="pack-cta">let's talk &rarr;</div>
			</div>
			<div class="pack featured">
				<div class="pack-name disp">Targeted Fix</div>
				<p class="pack-body">We fix the pillar that scored lowest — performance, AI-readiness, or SEO.</p>
				<div class="pack-cta">get a quote &rarr;</div>
			</div>
			<div class="pack">
				<div class="pack-name disp">Full Rebuild</div>
				<p class="pack-body">All three pillars handled together, with a faster, modern site to show for it.</p>
				<div class="pack-cta">start here &rarr;</div>
			</div>
		</div>

		<div class="services-link">parallaxandpixel.com</div>

		<div class="hairline section-rule"></div>

		<h3 class="mtitle disp">Methodology</h3>
		{#each m.methodologyLines as line (line)}
			<p class="meth-line faint">{line}</p>
		{/each}

		<div class="meta-grid faint">
			<div>audit id <span class="slash">//</span> {m.auditIdShort}</div>
			<div>engine <span class="slash">//</span> pxp-audit {m.engineVersion}</div>
			<div>captured <span class="slash">//</span> {m.capturedUtc}</div>
		</div>

		<p class="snapshot faint">
			This report is a snapshot. Sites change. Rerun any time at parallaxandpixel.com/audit.
		</p>

		{@render footer(6)}
	</section>
</div>

<!-- ══ SNIPPETS ════════════════════════════════════════════════════════ -->
{#snippet pageHeader()}
	<header class="chrome">
		<img class="chrome-logo" src="/icon.webp" alt="Parallax & Pixel" />
		<span class="chrome-meta">Website audit <span class="slash">//</span> {m.hostname} <span class="slash">//</span> {m.dateIso}</span>
	</header>
{/snippet}

{#snippet pillarHead(num: string, title: string, score: number)}
	<div class="pillar-head">
		<div>
			<div class="pillar-num disp">{num} <span class="slash">//</span> {title}</div>
			<div class="hairline pillar-rule"></div>
		</div>
		<div class="pillar-score grad disp">{score}</div>
	</div>
{/snippet}

{#snippet vital(v: VitalBar)}
	<div class="vital">
		<div class="vital-name disp">{v.metric} <span class="slash">//</span> {v.name}</div>
		<div class="vital-explainer mutedtxt">{v.explainer}</div>
		<div class="zone-bar">
			{#each v.zones as z (z.label)}
				<div class="zone zone-{z.tone}" style="flex-grow:{z.weight}">
					<span class="zone-label">{z.label}</span>
				</div>
			{/each}
			{#if v.markerPct !== null}
				<div class="marker marker-{v.youTone}" style="left:{(v.markerPct * 100).toFixed(1)}%"></div>
			{/if}
		</div>
		<div class="vital-ticks faint">
			{#each v.ticks as t (t)}<span>{t}</span>{/each}
		</div>
		<div class="vital-you you-{v.youTone}">{v.youLabel}</div>
	</div>
{/snippet}

{#snippet checklist(rows: ChecklistRow[])}
	<div class="checklist">
		{#each rows as row (row.name)}
			<div class="chk-row">
				<span class="chk-icon chk-{row.state}" aria-hidden="true">
					{#if row.state === 'ok'}
						<svg viewBox="0 0 12 12" width="12" height="12"><path d="M2 6.2 L5 9 L10 3" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
					{:else if row.state === 'warn'}
						<svg viewBox="0 0 12 12" width="12" height="12"><line x1="2.5" y1="6" x2="9.5" y2="6" stroke="currentColor" stroke-width="1.4" /></svg>
					{:else}
						<svg viewBox="0 0 12 12" width="12" height="12"><line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.4" /><line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" stroke-width="1.4" /></svg>
					{/if}
				</span>
				<div class="chk-text">
					<span class="chk-name">{row.name}</span>
					<span class="chk-status">{row.status}</span>
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet findingList(cards: FindingCard[])}
	{#if cards.length}
		<div class="findings">
			{#each cards as f (f.title)}
				<div class="finding">
					<div class="finding-top">
						<span class="sev sev-{f.severity}">{f.severity}</span>
						<span class="finding-title">{f.title}</span>
					</div>
					{#if f.description}<p class="finding-desc">{f.description}</p>{/if}
					{#if f.fix}
						<p class="finding-fix"><span class="fix-key">FIX <span class="slash">//</span></span> {f.fix}</p>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="clear mutedtxt">No issues flagged on this pillar. It cleared every check we ran.</p>
	{/if}
{/snippet}

{#snippet footer(page: number)}
	<div class="page-footer">
		<div class="hairline footer-rule"></div>
		<div class="footer-text">
			PARALLAX &amp; PIXEL <span class="slash">//</span> parallaxandpixel.com <span class="slash">//</span> {page} of {m.pageCount}
		</div>
	</div>
{/snippet}

<style>
	/* ── PRINT PAGE SETUP ──────────────────────────────────────────────
	   Light, print-/ink-efficient theme. White pages, dark text, brand
	   colour used only as accents (rules, score numbers, bar fills). The
	   old dark + Major Mono / JetBrains Mono treatment is retired; this
	   matches the 9realms Prospector report so both products ship one
	   visual standard. */
	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		background: #ffffff;
	}
	:global(#oro) {
		background: #ffffff !important;
	}

	@page {
		size: A4;
		margin: 0;
	}

	/* ── TOKENS ────────────────────────────────────────────────────── */
	.report {
		--page: #ffffff;
		--ink: #111827; /* headings */
		--body: #374151; /* body copy */
		--muted: #6b7280; /* captions, framing one-liners */
		--faint: #9ca3af; /* footer chrome, metadata, audit IDs */
		--line: #e5e7eb; /* card borders, neutral rules */
		--panel: #f9fafb; /* subtle block fill */
		--blue: #00a5cf; /* P&P cyan (accent-primary) */
		--green: #25a18e; /* P&P sea-green (accent-secondary) */
		--accent: #007a9c; /* labels / prompts — darkened cyan for contrast on white */
		--sev-urgent: #dc2626;
		--sev-warning: #d97706;
		--sev-ok: #059669;
		--sev-info: #6b7280;
		--grad: linear-gradient(90deg, #00a5cf, #25a18e);

		font-family: 'Raleway', ui-sans-serif, system-ui, sans-serif;
		color: var(--body);
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	.disp {
		font-family: 'Playfair Display', 'Raleway', serif;
		font-weight: 700;
	}
	.grad {
		background: var(--grad);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.slash {
		color: var(--blue);
		font-weight: 600;
	}
	.faint {
		color: var(--faint);
	}
	.mutedtxt {
		color: var(--muted);
	}
	.of {
		color: var(--faint);
		font-weight: 600;
	}

	/* ── PAGE FRAME ────────────────────────────────────────────────── */
	.page {
		width: 210mm;
		/* min-height (not fixed height) + no overflow:hidden so a content-heavy
		   pillar grows onto a second sheet instead of being clipped at 297mm.
		   The footer is pinned to the bottom in normal flow (margin-top:auto)
		   so content can never run underneath it. */
		min-height: 297mm;
		box-sizing: border-box;
		padding: 16mm;
		position: relative;
		background: var(--page);
		page-break-after: always;
		break-after: page;
		display: flex;
		flex-direction: column;
	}
	.page:last-child {
		page-break-after: auto;
		break-after: auto;
	}

	.hairline {
		height: 2px;
		background: var(--grad);
		border: none;
	}

	/* ── SHARED CHROME ─────────────────────────────────────────────── */
	.chrome {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10mm;
		padding-bottom: 4mm;
		border-bottom: 1px solid var(--line);
	}
	.chrome-logo {
		height: 7mm;
		width: auto;
	}
	.chrome-meta {
		font-size: 8.5pt;
		color: var(--muted);
		font-weight: 500;
	}
	.brandmark {
		font-size: 13pt;
		letter-spacing: -0.01em;
		background: var(--grad);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	/* ── PAGE TITLES ───────────────────────────────────────────────── */
	.ptitle {
		font-size: 22pt;
		letter-spacing: -0.01em;
		color: var(--ink);
		margin: 0 0 3mm;
	}
	.title-rule {
		width: 40mm;
		margin-bottom: 8mm;
	}
	.section-rule {
		width: 100%;
		height: 1px;
		background: var(--line);
		margin: 8mm 0 6mm;
	}
	.label {
		font-weight: 700;
		font-size: 8.5pt;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent);
		margin: 0 0 4mm;
	}
	.body {
		font-size: 11pt;
		line-height: 1.55;
		color: var(--body);
		max-width: 155mm;
		margin: 0 0 5mm;
	}
	.framing {
		font-size: 11pt;
		line-height: 1.5;
		color: var(--muted);
		max-width: 155mm;
		margin: 0 0 5mm;
	}

	/* ── COVER ─────────────────────────────────────────────────────── */
	.cover {
		background:
			radial-gradient(ellipse at top right, rgba(0, 165, 207, 0.06), transparent 55%),
			radial-gradient(ellipse at bottom left, rgba(37, 161, 142, 0.05), transparent 55%),
			var(--page);
		justify-content: flex-start;
	}
	.cover-logo {
		height: 11mm;
		width: auto;
		align-self: flex-start;
	}
	.cover-mid {
		margin-top: 24mm;
	}
	.cover-kicker {
		font-size: 15pt;
		letter-spacing: 0.18em;
		color: var(--muted);
		font-weight: 600;
	}
	.cover-date {
		font-size: 15pt;
		letter-spacing: 0.18em;
		color: var(--muted);
		font-weight: 600;
		margin-top: 1mm;
	}
	.cover-host {
		font-size: 28pt;
		color: var(--ink);
		margin-top: 8mm;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.cover-hero {
		text-align: center;
		margin-top: 8mm;
	}
	.hero-score {
		font-size: 150pt;
		line-height: 1;
		font-weight: 800;
	}
	.hero-rule {
		width: 40mm;
		margin: 2mm auto 3mm;
	}
	.hero-label {
		font-size: 11pt;
		color: var(--ink);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.hero-verdict {
		font-size: 13pt;
		margin-top: 2mm;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.cover-pillars {
		display: flex;
		justify-content: center;
		gap: 26mm;
		margin-top: 12mm;
	}
	.cp {
		text-align: center;
	}
	.cp-label {
		font-size: 10pt;
		letter-spacing: 0.06em;
		color: var(--muted);
		text-transform: uppercase;
		margin-bottom: 2mm;
		font-weight: 600;
	}
	.cp-score {
		font-size: 34pt;
		font-weight: 800;
	}
	.cover-foot-rule {
		width: 100%;
		margin-top: auto;
	}
	.cover-foot {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin-top: 5mm;
	}
	.cover-foot-left .faint {
		font-size: 9pt;
		margin-top: 1mm;
	}
	.cover-foot-right {
		text-align: right;
		font-size: 8.5pt;
		line-height: 1.5;
	}

	/* ── EXEC: WINS + PILLAR BARS ──────────────────────────────────── */
	.wins {
		display: flex;
		flex-direction: column;
		gap: 3mm;
		margin-bottom: 4mm;
	}
	.win {
		display: flex;
		gap: 4mm;
		align-items: baseline;
	}
	.win-idx {
		font-size: 12pt;
		background: var(--grad);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		font-weight: 800;
	}
	.win .body {
		margin: 0;
		font-size: 11pt;
	}

	.pbars {
		display: flex;
		flex-direction: column;
		gap: 6mm;
	}
	.pbar-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 2mm;
	}
	.pbar-name {
		font-size: 12pt;
		color: var(--ink);
		text-transform: capitalize;
	}
	.pbar-score {
		font-size: 16pt;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.bar-track {
		height: 5mm;
		background: #eef2f6;
		border: 1px solid var(--line);
	}
	.bar-fill {
		height: 100%;
		background: var(--grad);
	}
	.pbar-verdict {
		font-size: 8pt;
		margin-top: 1.5mm;
		text-align: right;
	}
	.v-excellent {
		color: var(--sev-ok);
	}
	.v-good {
		color: var(--blue);
	}
	.v-needs {
		color: var(--sev-warning);
	}
	.v-urgent {
		color: var(--sev-urgent);
	}
	.methodology-foot {
		font-size: 8.5pt;
		margin-top: 6mm;
	}

	/* ── PILLAR HEAD ───────────────────────────────────────────────── */
	.pillar-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 4mm;
	}
	.pillar-num {
		font-size: 18pt;
		letter-spacing: 0;
		color: var(--ink);
	}
	.pillar-rule {
		width: 90mm;
		margin-top: 3mm;
	}
	.pillar-score {
		font-size: 48pt;
		line-height: 0.9;
		font-weight: 800;
	}

	/* ── CORE WEB VITALS ───────────────────────────────────────────── */
	.vitals {
		display: flex;
		flex-direction: column;
		gap: 4.5mm;
		margin-bottom: 5mm;
	}
	.vital-name {
		font-size: 11pt;
		color: var(--ink);
	}
	.vital-explainer {
		font-size: 9.5pt;
		margin: 0.5mm 0 1.5mm;
	}
	.zone-bar {
		position: relative;
		display: flex;
		height: 7mm;
		border: 1px solid var(--line);
	}
	.zone {
		display: flex;
		align-items: center;
		justify-content: center;
		border-right: 1px solid var(--line);
	}
	.zone:last-child {
		border-right: none;
	}
	.zone-ok {
		background: rgba(5, 150, 105, 0.12);
	}
	.zone-warn {
		background: rgba(217, 119, 6, 0.13);
	}
	.zone-bad {
		background: rgba(220, 38, 38, 0.1);
	}
	.zone-label {
		font-size: 7.5pt;
		color: var(--muted);
		letter-spacing: 0.04em;
		font-weight: 600;
		text-transform: uppercase;
	}
	.marker {
		position: absolute;
		top: -2mm;
		width: 0;
		height: 0;
		border-left: 1.6mm solid transparent;
		border-right: 1.6mm solid transparent;
		border-top: 2.4mm solid var(--ink);
		transform: translateX(-1.6mm);
	}
	.marker-ok {
		border-top-color: var(--sev-ok);
	}
	.marker-warn {
		border-top-color: var(--sev-warning);
	}
	.marker-bad {
		border-top-color: var(--sev-urgent);
	}
	.vital-ticks {
		display: flex;
		justify-content: space-between;
		font-size: 7.5pt;
		margin-top: 1mm;
		font-variant-numeric: tabular-nums;
	}
	.vital-you {
		font-size: 8.5pt;
		text-align: right;
		margin-top: 1mm;
		font-weight: 600;
	}
	.you-ok {
		color: var(--sev-ok);
	}
	.you-warn {
		color: var(--sev-warning);
	}
	.you-bad {
		color: var(--sev-urgent);
	}
	.you-muted {
		color: var(--faint);
	}

	/* ── CHECKLIST ─────────────────────────────────────────────────── */
	.checklist {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3mm 5mm;
		margin-bottom: 6mm;
	}
	.chk-row {
		display: flex;
		gap: 3mm;
		align-items: flex-start;
		border: 1px solid var(--line);
		background: var(--panel);
		padding: 2.5mm 3mm;
	}
	.chk-icon {
		flex-shrink: 0;
		width: 12px;
		height: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid currentColor;
		margin-top: 0.5mm;
	}
	.chk-ok {
		color: var(--sev-ok);
	}
	.chk-warn {
		color: var(--sev-warning);
	}
	.chk-fail {
		color: var(--sev-urgent);
	}
	.chk-text {
		display: flex;
		flex-direction: column;
		gap: 0.5mm;
		min-width: 0;
	}
	.chk-name {
		font-size: 9.5pt;
		font-weight: 600;
		color: var(--ink);
	}
	.chk-status {
		font-size: 8.5pt;
		color: var(--muted);
		line-height: 1.35;
	}

	/* ── FINDINGS ──────────────────────────────────────────────────── */
	.findings {
		display: flex;
		flex-direction: column;
		gap: 3mm;
	}
	.finding {
		border: 1px solid var(--line);
		border-left: 3px solid var(--blue);
		background: var(--panel);
		padding: 3mm 3.5mm;
	}
	.finding-top {
		display: flex;
		gap: 3mm;
		align-items: baseline;
		margin-bottom: 1.5mm;
	}
	.sev {
		font-weight: 700;
		font-size: 7.5pt;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		flex-shrink: 0;
	}
	.sev-critical {
		color: var(--sev-urgent);
	}
	.sev-warning {
		color: var(--sev-warning);
	}
	.sev-info {
		color: var(--sev-info);
	}
	.finding-title {
		font-size: 10pt;
		font-weight: 600;
		color: var(--ink);
		line-height: 1.35;
	}
	.finding-desc {
		font-size: 9.5pt;
		line-height: 1.45;
		color: var(--body);
		margin: 0 0 1.5mm;
	}
	.finding-fix {
		font-size: 9.5pt;
		line-height: 1.45;
		color: var(--muted);
		margin: 0;
	}
	.fix-key {
		font-size: 8pt;
		font-weight: 700;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-right: 1mm;
	}
	.clear {
		font-size: 10pt;
	}

	/* ── PACKS (PAGE 6) ────────────────────────────────────────────── */
	.packs {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 4mm;
		margin-bottom: 4mm;
	}
	.pack {
		border: 1px solid var(--line);
		background: var(--panel);
		padding: 4mm;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2mm;
	}
	.pack.featured {
		background: #fff;
	}
	.pack.featured::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1.2mm;
		background: var(--grad);
	}
	.pack-name {
		font-size: 11pt;
		letter-spacing: 0;
		color: var(--ink);
	}
	.pack-price {
		font-size: 15pt;
		font-weight: 800;
	}
	.pack-body {
		font-size: 9pt;
		line-height: 1.45;
		color: var(--muted);
		margin: 0;
		flex: 1;
	}
	.pack-cta {
		font-size: 9.5pt;
		font-weight: 600;
		color: var(--accent);
	}
	.services-link {
		font-size: 10pt;
		font-weight: 600;
		color: var(--accent);
		margin-bottom: 2mm;
	}

	.mtitle {
		font-size: 14pt;
		color: var(--ink);
		margin: 0 0 3mm;
	}
	.meth-line {
		font-size: 8.5pt;
		line-height: 1.5;
		margin: 0 0 1.5mm;
		color: var(--muted);
	}
	.meta-grid {
		display: flex;
		flex-direction: column;
		gap: 1mm;
		font-size: 8pt;
		margin: 4mm 0;
		font-variant-numeric: tabular-nums;
	}
	.snapshot {
		font-size: 8.5pt;
		line-height: 1.5;
		color: var(--muted);
	}

	/* ── PAGE FOOTER ───────────────────────────────────────────────── */
	.page-footer {
		/* In normal flow, pushed to the bottom of the page's flex column so
		   content above can never overlap or hide behind it. On a content-heavy
		   pillar that grows past one sheet, the footer rides at the true bottom
		   of the section rather than being clipped mid-page. */
		margin-top: auto;
		padding-top: 6mm;
	}
	.footer-rule {
		width: 100%;
		height: 1px;
		background: var(--line);
		margin-bottom: 3mm;
	}
	.footer-text {
		font-size: 7.5pt;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--faint);
		font-weight: 500;
	}
</style>

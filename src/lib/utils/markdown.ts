// Shared, XSS-safe markdown renderer.
//
// Single source of truth for turning markdown into HTML for `{@html}`. ALWAYS
// route untrusted or agent-authored content (chat replies) through this — never
// `{@html marked(...)}` directly, which is a stored-XSS sink (a `<script>` /
// `onerror=` in the content runs in the dashboard's origin).
//
// marked turns markdown → HTML; DOMPurify strips anything executable (scripts,
// event-handler attributes, `javascript:`/`data:` URLs) while keeping the
// formatting tags. DOMPurify needs a DOM, so on the server (no `window`) we fall
// back to HTML-escaped plain text — safe and legible; the formatted, sanitized
// version hydrates on the client.

import { browser } from '$app/environment';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Render markdown to sanitized HTML suitable for `{@html}`.
 * Returns '' for empty input. On the server returns escaped plain text (no DOM
 * for DOMPurify); the client re-renders the sanitized markdown on hydration.
 */
export function renderMarkdown(md: string | null | undefined): string {
	if (!md) return '';
	if (!browser) return escapeHtml(md);
	const html = marked.parse(md, { async: false }) as string;
	return DOMPurify.sanitize(html);
}

/**
 * Sanitize a pre-built HTML string (already-HTML content, not markdown).
 * Same XSS guarantees as renderMarkdown. Server returns '' (nothing to safely
 * render without a DOM); render on the client.
 */
export function sanitizeHtml(html: string | null | undefined): string {
	if (!html) return '';
	if (!browser) return '';
	return DOMPurify.sanitize(html);
}

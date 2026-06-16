<script lang="ts">
	import { renderMarkdown } from '$lib/utils/markdown';
	import { browser } from '$app/environment';

	interface Props {
		role: 'user' | 'assistant';
		content: string;
		isStreaming?: boolean;
	}

	let { role, content, isStreaming = false }: Props = $props();

	// Only parse markdown once the message is final. While streaming we render
	// plain pre-wrap text (no per-token marked + sanitize work, no flicker).
	// SSR has no DOM for DOMPurify, so we render escaped raw text there too and
	// let the sanitized markdown render on the client after hydration.
	let useMarkdown = $derived(role === 'assistant' && browser && !isStreaming);
	let renderedContent = $derived(useMarkdown ? renderMarkdown(content) : '');
</script>

{#if role === 'user'}
	<div class="flex justify-end">
		<div class="max-w-[90%] border border-accent-primary/30 bg-accent-primary/10 px-3 py-1.5 text-sm text-slate-200 md:max-w-[75%]">
			<p class="whitespace-pre-wrap break-words">{content}</p>
		</div>
	</div>
{:else}
	<div class="w-full min-w-0 max-w-full text-sm text-slate-300">
		{#if useMarkdown}
			<div class="prose-mimir">
				{@html renderedContent}
			</div>
		{:else}
			<div class="prose-mimir whitespace-pre-wrap break-words">{content}</div>
		{/if}
		{#if isStreaming}
			<span class="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-accent-primary"></span>
		{/if}
	</div>
{/if}

<style>
	:global(.prose-mimir) {
		line-height: 1.6;
		/* Break long unbroken strings (URLs, hashes, paths an agent emits) instead
		   of letting them push the chat column past the viewport. */
		overflow-wrap: anywhere;
		word-break: break-word;
	}
	:global(.prose-mimir img) {
		max-width: 100%;
		height: auto;
	}
	:global(.prose-mimir a) {
		overflow-wrap: anywhere;
	}
	/* Roomier paragraph rhythm — a blank line between paragraphs should actually
	   read as a break, not a hairline. Agents are also prompted to emit real
	   `\n\n` breaks (see soul.ts formatting prelude), and this gives them room. */
	:global(.prose-mimir p) {
		margin: 0.7em 0;
	}
	:global(.prose-mimir p:first-child) {
		margin-top: 0;
	}
	:global(.prose-mimir p:last-child) {
		margin-bottom: 0;
	}
	:global(.prose-mimir strong) {
		color: rgb(226 232 240); /* slate-200 */
		font-weight: 600;
	}
	:global(.prose-mimir code) {
		background: rgb(30 41 59); /* slate-800 */
		padding: 0.15em 0.4em;
		border-radius: 0;
		font-size: 0.85em;
	}
	:global(.prose-mimir pre) {
		background: rgb(15 23 42); /* slate-900 */
		border: 1px solid rgb(30 41 59); /* slate-800 */
		border-radius: 0;
		padding: 0.5rem 0.75rem;
		margin: 0.7em 0;
		overflow-x: auto;
	}
	:global(.prose-mimir pre code) {
		background: none;
		padding: 0;
		font-size: 0.85em;
	}
	:global(.prose-mimir ul),
	:global(.prose-mimir ol) {
		padding-left: 1.5em;
		margin: 0.6em 0;
	}
	:global(.prose-mimir li) {
		margin: 0.25em 0;
	}
	:global(.prose-mimir blockquote) {
		border-left: 3px solid var(--accent-primary, #00a5cf);
		padding-left: 1em;
		margin: 0.7em 0;
		color: rgb(148 163 184); /* slate-400 */
	}
	/* Headings get clear air above to separate sections, tight below to hug their
	   content. first-child has no leading gap so the bubble doesn't start indented. */
	:global(.prose-mimir h1),
	:global(.prose-mimir h2),
	:global(.prose-mimir h3) {
		color: rgb(226 232 240); /* slate-200 */
		margin: 1em 0 0.3em;
		font-weight: 600;
	}
	:global(.prose-mimir h1:first-child),
	:global(.prose-mimir h2:first-child),
	:global(.prose-mimir h3:first-child) {
		margin-top: 0;
	}
	:global(.prose-mimir table) {
		display: block;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
		margin: 0.7em 0;
		font-size: 0.85em;
	}
	:global(.prose-mimir pre) {
		max-width: 100%;
	}
	:global(.prose-mimir th),
	:global(.prose-mimir td) {
		border: 1px solid rgb(30 41 59); /* slate-800 */
		padding: 0.4em 0.75em;
		text-align: left;
	}
	:global(.prose-mimir th) {
		background: rgb(30 41 59); /* slate-800 */
		color: rgb(226 232 240); /* slate-200 */
		font-weight: 600;
	}
</style>

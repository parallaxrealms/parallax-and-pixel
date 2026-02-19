import { Node } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import YouTubeEmbedNodeView from '../nodeViews/YouTubeEmbedNodeView.svelte';

export const YouTubeEmbedNode = Node.create({
	name: 'youtubeEmbed',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			url: { default: '' },
			videoId: { default: '' }
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-type="youtube-embed"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', { 'data-type': 'youtube-embed', ...HTMLAttributes }];
	},

	addNodeView() {
		return SvelteNodeViewRenderer(YouTubeEmbedNodeView, {
			stopEvent: ({ event }: { event: Event }) => {
				const target = event.target as HTMLElement;
				return target.tagName === 'INPUT' ||
					target.tagName === 'TEXTAREA' ||
					target.tagName === 'SELECT' ||
					target.tagName === 'BUTTON' ||
					target.closest('.node-view-controls') !== null;
			}
		});
	}
});

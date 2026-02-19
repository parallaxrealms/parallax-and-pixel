import { Node } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import GalleryNodeView from '../nodeViews/GalleryNodeView.svelte';

export const ThumbnailGalleryNode = Node.create({
	name: 'thumbnailGallery',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			images: { default: '[]' },
			columns: { default: 3 },
			aspectRatio: { default: '16/9' }
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-type="thumbnail-gallery"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', { 'data-type': 'thumbnail-gallery', ...HTMLAttributes }];
	},

	addNodeView() {
		return SvelteNodeViewRenderer(GalleryNodeView, {
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

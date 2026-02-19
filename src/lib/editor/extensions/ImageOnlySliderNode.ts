import { Node } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import ImageOnlySliderNodeView from '../nodeViews/ImageOnlySliderNodeView.svelte';

export const ImageOnlySliderNode = Node.create({
	name: 'imageOnlySlider',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			slides: { default: '[]' },
			autoplay: { default: true },
			interval: { default: 4500 },
			showArrows: { default: true },
			showDots: { default: true }
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-type="image-only-slider"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', { 'data-type': 'image-only-slider', ...HTMLAttributes }];
	},

	addNodeView() {
		return SvelteNodeViewRenderer(ImageOnlySliderNodeView, {
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

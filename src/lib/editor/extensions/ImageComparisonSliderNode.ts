import { Node } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import ComparisonSliderNodeView from '../nodeViews/ComparisonSliderNodeView.svelte';

export const ImageComparisonSliderNode = Node.create({
	name: 'imageComparisonSlider',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			beforeImage: { default: '' },
			afterImage: { default: '' },
			beforeLabel: { default: 'Before' },
			afterLabel: { default: 'After' },
			initialPosition: { default: 50 }
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-type="image-comparison-slider"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', { 'data-type': 'image-comparison-slider', ...HTMLAttributes }];
	},

	addNodeView() {
		return SvelteNodeViewRenderer(ComparisonSliderNodeView, {
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

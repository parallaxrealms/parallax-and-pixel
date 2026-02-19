import { Node } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import MultiColumnNodeView from '../nodeViews/MultiColumnNodeView.svelte';
import ColumnNodeView from '../nodeViews/ColumnNodeView.svelte';

export const ColumnNode = Node.create({
	name: 'column',
	group: 'column',
	content: 'block+',
	isolating: true,

	parseHTML() {
		return [{ tag: 'div[data-type="column"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', { 'data-type': 'column', ...HTMLAttributes }, 0];
	},

	addNodeView() {
		return SvelteNodeViewRenderer(ColumnNodeView, {
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

export const MultiColumnNode = Node.create({
	name: 'multiColumn',
	group: 'block',
	content: 'column{2,4}',
	draggable: true,

	addAttributes() {
		return {
			columns: { default: 2 }
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-type="multi-column"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', { 'data-type': 'multi-column', ...HTMLAttributes }, 0];
	},

	addNodeView() {
		return SvelteNodeViewRenderer(MultiColumnNodeView, {
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

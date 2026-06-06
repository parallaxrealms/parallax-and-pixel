<!-- src/lib/components/custom/CatalogMockupGrids/UserTemplatesGrid.svelte -->
<script lang="ts">
	import { Card, Button } from '@parallaxrealms/pxp-components';
	import type { DesignData, UserTemplate } from '@parallaxrealms/pxp-types/rune';

	let { templates = [], onUseTemplate } = $props<{
		templates: UserTemplate[];
		onUseTemplate: (t: UserTemplate) => void;
	}>();
</script>

<div class="user-templates-grid">
	{#if templates.length === 0}
		<p class="text-sm text-slate-500">You haven’t saved any templates yet.</p>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each templates as t}
				<Card variant="elevated" class="flex flex-col p-4">
					<div class="relative mb-3 aspect-square overflow-hidden rounded bg-white">
						{#if t.ss_color_front_image}
							<img
								src={`https://www.ssactivewear.com/${t.ss_color_front_image}`}
								alt={t.product_title ?? 'Template'}
								class="h-full w-full object-contain"
							/>
						{/if}

						<!-- Overlay design preview -->
						{#if t.front_design}
							<img
								src={t.front_design.imageUrl}
								alt="Front design"
								class="absolute inset-0 m-auto max-h-[80%] max-w-[80%] object-contain"
							/>
						{/if}
					</div>

					<h3 class="mb-1 text-base font-semibold text-white">
						{t.name}
					</h3>

					<p class="mb-2 text-xs text-slate-400">
						{t.brand_name}
						{t.product_title}
					</p>

					<p class="mb-4 text-xs text-slate-400">
						{t.ss_color_name}
						{t.ss_size_name}
					</p>

					<Button variant="default" size="sm" class="mt-auto" onclick={() => onUseTemplate(t)}>
						Use Template
					</Button>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<style>
	.user-templates-grid {
		margin-top: 1rem;
	}
</style>

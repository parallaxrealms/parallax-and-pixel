<!-- src/lib/components/custom/CatalogMockupGrids/RecentPurchasesGrid.svelte -->
<script lang="ts">
	import { Card, Button } from '@parallaxrealms/components-core';
	import type { UserTemplate } from '@parallaxrealms/types-rune';

	let { items = [], onUseRecent } = $props<{
		items: UserTemplate[];
		onUseRecent: (t: UserTemplate) => void;
	}>();
</script>

<div class="recent-purchases-grid">
	{#if items.length === 0}
		<p class="text-sm text-slate-500">You have no recent purchases yet.</p>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each items as t}
				<Card variant="elevated" class="flex flex-col p-4">
					<div class="relative mb-3 aspect-square overflow-hidden rounded bg-white">
						{#if t.ss_color_front_image}
							<img
								src={`https://www.ssactivewear.com/${t.ss_color_front_image}`}
								alt={t.product_title ?? 'Recent purchase'}
								class="h-full w-full object-contain"
							/>
						{/if}

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

					<Button variant="default" size="sm" class="mt-auto" onclick={() => onUseRecent(t)}>
						Reorder
					</Button>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<style>
	.recent-purchases-grid {
		margin-top: 1rem;
	}
</style>

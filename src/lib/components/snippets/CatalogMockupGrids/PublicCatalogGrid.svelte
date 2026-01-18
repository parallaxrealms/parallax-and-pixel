<!-- src/lib/components/custom/CatalogMockupGrids/PublicCatalogGrid.svelte -->
<script lang="ts">
	import { Badge } from '@parallaxrealms/components-core';
	import { CatalogMockupCard } from '@parallaxrealms/components-ecom';
	import type { CatalogItem, CatalogVariant } from '@parallaxrealms/types-ecom';
	import type { DesignData, UploadedDesign } from '@parallaxrealms/types-rune';

	type CatalogItemWithVariants = CatalogItem & { catalog_variants: CatalogVariant[] };

	let {
		title = 'Public Catalog',
		products = [] as CatalogItemWithVariants[],
		design = null as DesignData | null,
		getHref = (product: CatalogItemWithVariants) => `/create/${product.ss_style_id}`
	} = $props<{
		title?: string;
		products: CatalogItemWithVariants[];
		design?: DesignData | null;
		getHref?: (product: CatalogItemWithVariants) => string;
	}>();
</script>

<div class="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-6">
	{#each products as product (product.id)}
		<CatalogMockupCard
			{product}
			{design}
			href={getHref(product)}
			{Badge}
		/>
	{/each}
</div>

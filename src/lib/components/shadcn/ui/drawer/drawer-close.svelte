<script lang="ts">
	import { Drawer as DrawerPrimitive } from "vaul-svelte";

	let { ...restProps } = $props();
</script>

<DrawerPrimitive.Close data-slot="drawer-close" {...restProps} />

<script lang="ts">
	import { Drawer as DrawerPrimitive } from "vaul-svelte";

	let { ...restProps } = $props();
</script>

<DrawerPrimitive.Trigger data-slot="drawer-trigger" {...restProps} />

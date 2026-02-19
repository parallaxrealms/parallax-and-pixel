<script lang="ts">
	let { children } = $props();
</script>

<!-- Editor route has its own navbar, skip the default admin nav -->
{@render children()}

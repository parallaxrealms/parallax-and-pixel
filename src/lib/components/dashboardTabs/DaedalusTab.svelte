<script lang="ts">
	/**
	 * Admin DAEDALUS tab — thin wrapper that mounts the DAEDALUS Studio (scene
	 * authoring + live preview). Built-in scenes are read-only templates; user
	 * scenes persist to localStorage (PxP MVP — no DB table yet, see
	 * $lib/daedalus/store.ts). Convention: dashboard tabs receive {supabase}.
	 */
	import type { SupabaseClient } from '@supabase/supabase-js';
	import DaedalusStudio from '$lib/components/dashboardTabs/daedalus/DaedalusStudio.svelte';

	let { supabase } = $props<{ supabase: SupabaseClient }>();
</script>

<div
	class="mx-auto h-[calc(100vh-9rem)] min-h-[28rem] w-full border border-slate-800 bg-slate-950 sm:min-h-[34rem]"
>
	<DaedalusStudio {supabase} />
</div>

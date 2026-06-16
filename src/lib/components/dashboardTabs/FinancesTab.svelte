<script lang="ts">
	// Thin wrapper so the Finances tab is imported the same way as the other
	// dashboard tabs (from $lib/components/dashboardTabs/FinancesTab.svelte).
	import type { SupabaseClient } from '@supabase/supabase-js';
	import FinancesTab from './finances/FinancesTab.svelte';

	let { supabase } = $props<{ supabase: SupabaseClient }>();
</script>

<FinancesTab {supabase} />

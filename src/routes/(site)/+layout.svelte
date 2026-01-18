<script lang="ts">
	import '../../app.css';
	import type { Session, User } from '@supabase/supabase-js';
	import { invalidate } from '$app/navigation';

	let { children, data } = $props<{
		session: Session | null;
		user: User | null;
	}>();
	let supabase = $derived(data.supabase);
	let session = $derived(data.session);

	$effect(() => {
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange(async (event: any, _session: any) => {
			if (_session?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => subscription.unsubscribe();
	});
</script>

{@render children?.()}

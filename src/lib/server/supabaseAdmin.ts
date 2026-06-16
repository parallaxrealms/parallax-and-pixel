import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { createLogger } from '$lib/server/logger';

const log = createLogger('supabaseAdmin');

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
	if (client) return client;
	const key = env.PRIVATE_SUPABASE_KEY;
	if (!key) {
		log.error('PRIVATE_SUPABASE_KEY not configured');
		throw new Error('PRIVATE_SUPABASE_KEY is not configured');
	}
	client = createClient(PUBLIC_SUPABASE_URL, key, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	log.info('admin client initialised');
	return client;
}

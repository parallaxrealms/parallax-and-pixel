import { createSupportNotifyResolvedHandler } from '@parallaxrealms/api-auth';
import { RESEND_API_KEY, PRIVATE_SUPABASE_SATORI_KEY, FROM_EMAIL } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

// Use factory pattern with custom configuration
// Configure FROM_EMAIL in your .env file
export const POST = createSupportNotifyResolvedHandler({
	resendApiKey: RESEND_API_KEY,
	fromEmail: FROM_EMAIL || 'noreply@example.com',
	supabaseUrl: PUBLIC_SUPABASE_URL,
	supabaseSecretKey: PRIVATE_SUPABASE_SATORI_KEY
});

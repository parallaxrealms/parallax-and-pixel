import { createSupportNotifyAdminHandler } from '@parallaxrealms/api-auth';
import { SENDGRID_API_KEY, ADMIN_EMAIL, FROM_EMAIL } from '$env/static/private';

// Use factory pattern with custom configuration
// Configure ADMIN_EMAIL and FROM_EMAIL in your .env file
export const POST = createSupportNotifyAdminHandler({
	sendgridApiKey: SENDGRID_API_KEY,
	adminEmail: ADMIN_EMAIL || 'admin@example.com',
	fromEmail: FROM_EMAIL || 'noreply@example.com'
});

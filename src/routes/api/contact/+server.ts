// src/routes/api/contact/+server.ts
import { createContactHandler } from '@parallaxrealms/pxp-utils/api-core';
import { CONTACT_EMAIL, FROM_EMAIL, RESEND_API_KEY } from '$env/static/private';

/**
 * Contact form API endpoint using the configurable handler factory.
 *
 * Configuration is pulled from environment variables:
 * - CONTACT_EMAIL: Where to send contact form submissions
 * - FROM_EMAIL: Email address to send from (optional, defaults to CONTACT_EMAIL)
 * - RESEND_API_KEY: Resend API key for sending emails
 */
export const POST = createContactHandler({
  recipientEmail: CONTACT_EMAIL || 'admin@satoridigital.io',
  fromEmail: FROM_EMAIL || CONTACT_EMAIL || 'admin@satoridigital.io',
  resendApiKey: RESEND_API_KEY
});

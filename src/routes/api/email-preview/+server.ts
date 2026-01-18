// src/routes/api/email-preview/+server.ts
// SendGrid templates API - list and send dynamic template emails

/**
 * This endpoint provides two functions:
 * 
 * GET - List all SendGrid dynamic templates with their active versions
 * Used for: Admin panels, template selection UIs, testing
 * 
 * POST - Send an email using a SendGrid dynamic template
 * Used for: Transactional emails (welcome, reset password, order confirmation, etc.)
 */

export { GET, POST } from '@parallaxrealms/api-auth/routes/api/email-preview/+server';

/**
 * Usage Examples:
 * 
 * GET /api/email-preview
 * Returns: { success: true, templates: EmailTemplate[] }
 *
 * POST /api/email-preview
 * Body: {
 *   to: "user@example.com",
 *   templateId: "d-abc123xyz",
 *   dynamicTemplateData: {
 *     name: "John Doe",
 *     confirmationUrl: "https://mysite.com/confirm/xyz"
 *   },
 *   from: "noreply@mysite.com",  // Optional, defaults to FROM_EMAIL env var
 *   sandbox: false  // Optional, true for testing without sending
 * }
 * Returns: { success: true }
 * 
 * Environment Variables Required:
 * - SENDGRID_API_KEY: Your SendGrid API key
 * - FROM_EMAIL: Default sender email (optional, can be overridden per request)
 */

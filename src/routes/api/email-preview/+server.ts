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
 *   templateId: "contact-form",
 *   dynamicTemplateData: {
 *     name: "John Doe",
 *     email: "john@example.com"
 *   },
 *   from: "noreply@mysite.com",  // Optional, defaults to FROM_EMAIL env var
 * }
 * Returns: { success: true }
 *
 * Environment Variables Required:
 * - RESEND_API_KEY: Your Resend API key
 * - FROM_EMAIL: Default sender email (optional, can be overridden per request)
 */

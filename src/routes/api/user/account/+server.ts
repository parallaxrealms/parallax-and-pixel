// Account Management API - deactivate and delete user accounts
import {
  createAccountDeletionHandler,
  createAccountDeactivationHandler
} from '@parallaxrealms/api-ecom';

/**
 * Account Management API endpoint using the configurable handler factories.
 *
 * DELETE: Request account deletion (soft delete with grace period)
 *         Requires confirmation text: "DELETE MY ACCOUNT"
 *         User will be signed out after successful request
 *
 * POST: Deactivate or reactivate account
 *       Body: { action: 'deactivate' | 'reactivate' }
 *       User will be signed out after deactivation
 */
export const DELETE = createAccountDeletionHandler({
  softDeleteOnly: true,
  gracePeriodDays: 30
});

export const POST = createAccountDeactivationHandler({});

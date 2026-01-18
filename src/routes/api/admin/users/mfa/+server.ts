import { handleAdminMfaDelete } from '@parallaxrealms/api-core';

/**
 * DELETE /api/admin/users/mfa
 * Remove all MFA factors for a user
 * Uses default handler from api-core with environment variables
 */
export const DELETE = handleAdminMfaDelete;

import { handleAdminMfaDelete } from '@parallaxrealms/pxp-utils/api-core';

/**
 * DELETE /api/admin/users/mfa
 * Remove all MFA factors for a user
 * Uses default handler from api-core with environment variables
 */
export const DELETE = handleAdminMfaDelete;

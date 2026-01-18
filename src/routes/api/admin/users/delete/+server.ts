import { handleAdminDeleteUser } from '@parallaxrealms/api-core';

/**
 * DELETE /api/admin/users/delete
 * Permanently delete a user from the system
 * Uses default handler from api-core with environment variables
 */
export const DELETE = handleAdminDeleteUser;

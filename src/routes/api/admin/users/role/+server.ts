import { handleAdminRolePost } from '@parallaxrealms/api-core';

/**
 * POST /api/admin/users/role
 * Update a user's role
 * Uses default handler from api-core with environment variables
 */
export const POST = handleAdminRolePost;

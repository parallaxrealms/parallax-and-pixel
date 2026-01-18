import { handleAdminBanPost } from '@parallaxrealms/api-core';

/**
 * POST /api/admin/users/ban
 * Ban or unban a user
 * Uses default handler from api-core with environment variables
 */
export const POST = handleAdminBanPost;

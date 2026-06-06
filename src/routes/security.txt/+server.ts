import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Legacy location support: redirect /security.txt to the RFC 9116 well-known location
export const GET: RequestHandler = () => {
	redirect(301, '/.well-known/security.txt');
};

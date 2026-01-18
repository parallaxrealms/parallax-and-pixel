// src/routes/(site)/+page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, data }) => {
  const parentData = await parent();

  return {
    ...parentData,
    ...data 
  };
};
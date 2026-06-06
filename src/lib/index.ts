// Re-export types
export type * from '@parallaxrealms/pxp-types/core';
export type * from '@parallaxrealms/pxp-types/auth';
export type * from '@parallaxrealms/pxp-types/ecom';
export type * from '@parallaxrealms/pxp-types/rune';
export type { Page as BasePage } from '@parallaxrealms/pxp-types/edda';

// Extend Page type with local fields
import type { Page as BasePage } from '@parallaxrealms/pxp-types/edda';
export interface Page extends BasePage {
	category?: string | null;
}

// Re-export utils
export * from '@parallaxrealms/pxp-utils/core';
export * from '@parallaxrealms/pxp-utils/ecom';
export * from '@parallaxrealms/pxp-utils/rune';

// Re-export stores
export * from '@parallaxrealms/pxp-utils/stores-core';
export * from '@parallaxrealms/pxp-utils/stores-ecom';

// Re-export schemas
export * from '@parallaxrealms/pxp-types/schemas';

// Re-export components
export * from '@parallaxrealms/pxp-components';
export * from '@parallaxrealms/pxp-components/editor';
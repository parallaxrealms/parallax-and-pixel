// Re-export types
export type * from '@parallaxrealms/types-core';
export type * from '@parallaxrealms/types-auth';
export type * from '@parallaxrealms/types-ecom';
export type * from '@parallaxrealms/types-rune';
export type { Page as BasePage } from '@parallaxrealms/types-edda';

// Extend Page type with local fields
import type { Page as BasePage } from '@parallaxrealms/types-edda';
export interface Page extends BasePage {
	category?: string | null;
}

// Re-export utils
export * from '@parallaxrealms/utils-core';
export * from '@parallaxrealms/utils-ecom';
export * from '@parallaxrealms/utils-rune';

// Re-export stores
export * from '@parallaxrealms/stores-core';
export * from '@parallaxrealms/stores-ecom';

// Re-export schemas
export * from '@parallaxrealms/schemas';

// Re-export components
export * from '@parallaxrealms/components-core';
export * from '@parallaxrealms/components-edda';
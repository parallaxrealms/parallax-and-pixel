import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type UserConfig } from 'vite';
import path from 'path';

export default defineConfig(async (): Promise<UserConfig> => {
	return {
		plugins: [tailwindcss(), sveltekit()],
		optimizeDeps: {
			exclude: [
				'@parallaxrealms/components-core',
				'@parallaxrealms/components-ecom',
				'@parallaxrealms/stores-ecom',
				'@parallaxrealms/utils-core'
				// DO NOT add components-edda here - it needs pre-bundling for highlight.js
			]
		},
		resolve: {
			alias: {
				'@lib': path.resolve('node_modules/@parallaxrealms/components-core/src/lib')
			}
		},
		server: {
			fs: {
				allow: ['node_modules/@parallaxrealms']
			}
		},
		ssr: {
			noExternal: [
				/^@parallaxrealms\//,
				'lucide-svelte',
				'embla-carousel-svelte',
				'svelte-sonner',
				'vaul-svelte',
				'bits-ui'
			]
		},
		build: {
			rollupOptions: { external: [] }
		}
	};
});

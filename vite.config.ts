import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type UserConfig } from 'vite';
import path from 'path';

export default defineConfig(async (): Promise<UserConfig> => {
	return {
		plugins: [tailwindcss(), sveltekit()],
		resolve: {
			alias: {
				// REQUIRED: Vite needs this to resolve @lib imports in component packages
				'@lib': path.resolve('node_modules/@parallaxrealms/components-core/src/lib')
			}
		},
		server: {
			fs: {
				// Allow Vite to access component package source files
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

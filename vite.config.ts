import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type UserConfig } from 'vite';
import path from 'path';

export default defineConfig(async (): Promise<UserConfig> => {
	return {
		plugins: [tailwindcss(), sveltekit()],
		optimizeDeps: {
			exclude: [
				'@parallaxrealms/pxp-components',
				'@parallaxrealms/pxp-utils'
			]
		},
		resolve: {
			alias: {
				'@lib': path.resolve('node_modules/@parallaxrealms/pxp-components/src/lib')
			}
		},
		server: {
			fs: {
				allow: ['node_modules/@parallaxrealms']
			}
		},
		ssr: {
			noExternal: [
				/^@parallaxrealms\/pxp-(?!otel)/,
				'lucide-svelte',
				'embla-carousel-svelte',
				'svelte-sonner',
				'vaul-svelte',
				'bits-ui'
			],
			external: [/^@opentelemetry\//, '@parallaxrealms/pxp-otel']
		},
		build: {
			rollupOptions: { external: [] }
		}
	};
});

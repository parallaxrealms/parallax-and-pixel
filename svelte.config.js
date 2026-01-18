import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import 'dotenv/config'; // same as calling config()

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			$lib: 'src/lib',   // built-in alias kept explicit
			'@': 'src/lib',     // nice-to-have short alias
			// Map @lib to components-core for shadcn components
			'@lib': 'node_modules/@parallaxrealms/components-core/src/lib',
			'@lib/*': 'node_modules/@parallaxrealms/components-core/src/lib/*'
		}
	}
};

export default config;

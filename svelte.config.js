import adapterNode from '@sveltejs/adapter-node';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';

// Two deployment targets share this config:
//
//   (default)            → adapter-node. Local dev, the macOS LaunchAgent,
//                          and Render. Produces ./build, run with `node build`.
//   ADAPTER=cloudflare   → adapter-cloudflare. The hosted read-only viewer on
//                          Cloudflare Pages. Produces .svelte-kit/cloudflare.
//
// The default is deliberately adapter-node so Render needs no configuration
// change of any kind: absent the variable, nothing about its build differs.

const useCloudflare = process.env.ADAPTER === 'cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: useCloudflare ? adapterCloudflare() : adapterNode()
	}
};

export default config;

import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig( {
	cacheDir: "../../node_modules/.vite/ui",
	plugins: [ viteTsConfigPaths( { root: "../../" } ) ],
	test: {
		globals: true,
		cache: {
			dir: "../../node_modules/.vitest/ui"
		},
		environment: "jsdom",
		include: [ "(src|tests)/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}" ],
		exclude: [ ".storybook", "src/*.stories.tsx" ],
		coverage: {
			reporter: [ "text", "json", "html" ],
			provider: "istanbul",
			enabled: true,
			include: [ "src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}" ],
			exclude: [ "src/index.ts", "src/**/*.stories.tsx", ".storybook" ],
			all: true,
			clean: true,
			reportsDirectory: "coverage"
		}
	}
} );
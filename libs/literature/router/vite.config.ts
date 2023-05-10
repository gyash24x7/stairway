import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig( {
	cacheDir: "../../../node_modules/.vite/literature/router",
	plugins: [ viteTsConfigPaths( { root: "../../../" } ) ],
	test: {
		globals: true,
		cache: {
			dir: "../../../node_modules/.vitest/literature/router"
		},
		environment: "node",
		include: [ "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}" ],
		coverage: {
			reporter: [ "text", "json", "html" ],
			provider: "istanbul",
			enabled: true,
			include: [ "src/**/*.ts" ],
			exclude: [ "src/index.ts" ],
			all: true,
			clean: true,
			reportsDirectory: "coverage"
		}
	}
} );
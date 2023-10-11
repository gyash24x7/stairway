import { defineConfig } from "vitest/config";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";

export default defineConfig( {
	cacheDir: "../../../node_modules/.vite/cards",
	plugins: [ nxViteTsPaths() ],
	test: {
		globals: true,
		coverage: {
			enabled: true,
			provider: "istanbul",
			reportsDirectory: "coverage"
		},
		cache: {
			dir: "../../../node_modules/.vitest/cards"
		},
		environment: "node",
		include: [ "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}" ]
	}
} );

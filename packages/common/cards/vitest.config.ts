import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import { defineConfig } from "vitest/config";

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

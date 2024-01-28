import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import { defineConfig } from "vitest/config";

export default defineConfig( {
	plugins: [ nxViteTsPaths() ],
	test: {
		globals: true,
		coverage: {
			enabled: true,
			provider: "istanbul",
			reportsDirectory: "coverage"
		},
		environment: "node",
		include: [ "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}" ]
	}
} );

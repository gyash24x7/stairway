import { defineConfig } from "vitest/config";

export default defineConfig( {
	cacheDir: "../../../node_modules/.vite/auth/core",
	test: {
		globals: true,
		coverage: {
			enabled: true,
			provider: "istanbul",
			reportsDirectory: "coverage"
		},
		cache: {
			dir: "../../../node_modules/.vitest/auth/core"
		},
		environment: "node",
		include: [ "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}" ]
	}
} );

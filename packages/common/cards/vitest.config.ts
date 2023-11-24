import { defineConfig } from "vitest/config";

export default defineConfig( {
	cacheDir: "../../../node_modules/.vite/cards",
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

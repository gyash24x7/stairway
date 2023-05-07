import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig( {
	plugins: [ viteTsConfigPaths( { root: "../../../" } ) ],
	test: {
		cache: false,
		environment: "node",
		include: [ "tests/**/*.test.ts" ],
		coverage: {
			reporter: [ "text", "json", "html" ],
			provider: "istanbul",
			enabled: true,
			include: [ "src/**/*.ts" ],
			exclude: [ "src/main.ts" ],
			all: true,
			clean: true,
			reportsDirectory: "coverage"
		}
	}
} );
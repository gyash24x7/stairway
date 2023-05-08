import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig( {
	plugins: [ viteTsConfigPaths( { root: "../../" } ) ],
	test: {
		cache: false,
		environment: "jsdom",
		include: [ "**/*.test.tsx" ],
		coverage: {
			reporter: [ "text", "json", "html" ],
			provider: "istanbul",
			enabled: true,
			include: [ "src/**/*.tsx" ],
			exclude: [ "src/**/*.stories.tsx" ],
			all: true,
			clean: true,
			reportsDirectory: "coverage"
		}
	}
} );
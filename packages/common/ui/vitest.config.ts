import { defineConfig } from "vitest/config";

export default defineConfig( {
	test: {
		passWithNoTests: true,
		environment: "jsdom",
		coverage: {
			enabled: true,
			provider: "istanbul",
			reportsDirectory: "coverage"
		}
	}
} );
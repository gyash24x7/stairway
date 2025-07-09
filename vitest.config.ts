import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig( {
	plugins: [
		tsconfigPaths()
	],
	test: {
		name: "stairway:test",
		globals: true,
		passWithNoTests: true,
		coverage: {
			enabled: true,
			provider: "istanbul",
			clean: true,
			thresholds: {
				functions: 90,
				lines: -10
			}
		}
	}
} );
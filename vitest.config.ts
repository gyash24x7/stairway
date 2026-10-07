import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";


export default defineConfig( {
	resolve: {
		alias: {
			"@": fileURLToPath( new URL( "./src", import.meta.url ) ),
			"@tests": fileURLToPath( new URL( "./tests", import.meta.url ) )
		}
	},
	test: {
		include: [ "tests/**/*.test.ts" ],
		environment: "node",
		globals: false,
		testTimeout: 20_000,
		hookTimeout: 20_000,
		/**
		 * Run this under Node — `bun run test:coverage` deliberately drops the
		 * `--bun` the other test scripts carry. The v8 provider merges its range
		 * trees recursively, and under Bun that recursion overflows the stack on a
		 * suite this size before a report is ever written.
		 */
		coverage: {
			provider: "v8",
			reporter: [ "text", "html", "lcov" ],
			reportsDirectory: "coverage",

			/**
			 * What the suite is actually written against: the engine and the games'
			 * rules. `all` so a file nothing imports still shows up at zero rather
			 * than quietly counting as covered by absence.
			 */
			include: [ "src/swish/**/*.ts", "src/games/**/*.ts", "src/shared/utils/*.ts" ],
			/**
			 * The HTTP surface is left out on purpose. `contract.ts`, `endpoints.ts`
			 * and every `handlers.ts` are declarations and one-line adapters onto the
			 * engine — the thing they delegate to is what this suite drives, and
			 * counting them would only measure whether an HTTP server was started.
			 */
			exclude: [
				"src/**/ui/**",
				"src/**/*.tsx",
				"src/games/*/contract.ts",
				"src/games/*/server/handlers.ts",
				"src/games/wordle/dictionary.ts",
				"src/swish/endpoints.ts",
				"src/**/tables.ts"
			],

			/**
			 * A floor, not a target. Set just under where the suite currently sits,
			 * so a change that guts coverage fails rather than merely looking worse.
			 * Raise them when the number moves up; do not lower them to make a run
			 * green.
			 */
			thresholds: {
				statements: 90,
				branches: 81,
				functions: 93,
				lines: 90
			}
		}
	}
} );

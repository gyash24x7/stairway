import type { Config } from "drizzle-kit";

export default {
	schema: [
		"packages/backend/auth/src/auth.schema.ts",
		"packages/backend/wordle/src/wordle.schema.ts",
		"packages/backend/literature/src/literature.schema.ts"
	],
	out: "./migrations"
} satisfies Config;
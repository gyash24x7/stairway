import type { Config } from "drizzle-kit";

export default {
	dialect: "postgresql",
	schema: [
		"packages/api/auth/src/auth.schema.ts",
		"packages/api/wordle/src/wordle.schema.ts",
		"packages/api/literature/src/literature.schema.ts"
	],
	out: "./migrations"
} satisfies Config;
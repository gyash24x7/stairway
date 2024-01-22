import type { Config } from "drizzle-kit";

export default {
	schema: "./src/literature.schema.ts",
	out: "./migrations"
} satisfies Config;
import type { Config } from "drizzle-kit";

export default {
	schema: [ "packages/**/*.schema.ts" ],
	out: "migrations"
} satisfies Config;
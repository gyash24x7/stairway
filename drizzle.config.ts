import type { Config } from "drizzle-kit";

export default {
	schema: [ "packages/**/data/src/*.schema.ts" ],
	out: "migrations"
} satisfies Config;
import { defineConfig } from "drizzle-kit";

export default defineConfig( {
	dialect: "sqlite",
	schema: "../../packages/workers/auth/src/schema.ts",
	out: "./migrations"
} );
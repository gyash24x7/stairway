import { defineConfig } from "drizzle-kit";

export default defineConfig( {
	dialect: "sqlite",
	schema: "./packages/shared/platform/src/database/schema.ts",
	out: "./migrations",
	migrations: { table: "drizzle_migrations" }
} );
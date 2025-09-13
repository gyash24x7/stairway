import { defineConfig } from "drizzle-kit";

export default defineConfig( {
	dialect: "sqlite",
	schema: [ "./src/workers/auth/schema.ts" ],
	out: "./migrations"
} );
import { defineConfig } from "drizzle-kit";

export default defineConfig( {
	out: "./migrations",
	schema: [ "./src/auth/schema.ts" ],
	dialect: "sqlite"
} );

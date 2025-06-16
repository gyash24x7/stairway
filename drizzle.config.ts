import { defineConfig } from "drizzle-kit";

export default defineConfig( {
	out: "./migrations",
	schema: [
		"./src/auth/schema.ts"
		// "./src/wordle/schema.ts",
		// "./src/callbreak/schema.ts",
		// "./src/literature/schema.ts"
	],
	dialect: "sqlite"
} );

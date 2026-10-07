import { defineConfig } from "drizzle-kit";

export default defineConfig( {
	dialect: "postgresql",
	schema: [ "./src/auth/server/tables.ts", "./src/swish/server/tables.ts" ],
	out: "./migrations",
	dbCredentials: { url: process.env[ "DATABASE_URL" ]! },
	tablesFilter: [
		"users",
		"passkeys",
		"games",
		"game_players",
		"game_spectators",
		"game_commits"
	]
} );

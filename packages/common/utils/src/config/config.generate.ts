import process from "node:process";
import type { AppConfig } from "./config.types";

export function generateConfig(): AppConfig {
	const host = process.env[ "APP_HOST" ] || "localhost";
	const port = parseInt( process.env[ "APP_PORT" ] || "8000" );
	const dbUrl = process.env[ "DATABASE_URL" ] ?? "mongodb://localhost:27017/stairway";

	return {
		appInfo: { id: "stairway", name: "Stairway", host, port },
		db: { url: dbUrl ?? "" },
		auth: {
			audience: process.env[ "AUTH_AUDIENCE" ] ?? "",
			domain: process.env[ "AUTH_DOMAIN" ] ?? "",
			privateKeyPath: "assets/keys/.private.key",
			publicKeyPath: "assets/keys/.public.key.pem"
		}
	};
}

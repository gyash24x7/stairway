import process from "node:process";
import type { AppConfig } from "./config.types";
import { camelCase, pascalCase } from "change-case";

export function generateConfig( app: string ): AppConfig {
	const host = process.env[ "APP_HOST" ] || "localhost";
	const port = parseInt( process.env[ "APP_PORT" ] || "8000" );
	const dbUrl = process.env[ "DATABASE_URL" ];

	return {
		appInfo: { id: camelCase( app ), name: pascalCase( app ), host, port },
		db: { url: dbUrl ?? "" },
		auth: {
			audience: process.env[ "AUTH_AUDIENCE" ] ?? "",
			domain: process.env[ "AUTH_DOMAIN" ] ?? "",
			privateKeyPath: "assets/keys/.private.key",
			publicKeyPath: "assets/keys/.public.key.pem"
		}
	};
}

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { StairwayDatabase } from "@/platform/database/service.ts";
import { ArchiveKV } from "@/platform/kv/archive.ts";
import { SessionKV } from "@/platform/kv/session.ts";
import { WebAuthnKV } from "@/platform/kv/webauthn.ts";
import { default as ApiWorker } from "@/worker.ts";

export default Alchemy.Stack(
	"Stairway",
	{
		providers: Layer.mergeAll(
			Cloudflare.providers(),
			Drizzle.providers()
		),
		state: Cloudflare.state()
	},
	Effect.gen( function* () {
		const sessionKv = yield* SessionKV;
		const webauthnKv = yield* WebAuthnKV;
		const archiveKv = yield* ArchiveKV;
		const db = yield* StairwayDatabase;

		const api = yield* ApiWorker;
		const web = yield* Cloudflare.Website.Vite( "WebWorker", {
			dev: { port: 5173 },
			env: {
				VITE_API_URL: api.url.as<string>(),
				// The browser needs the VAPID public key to call
				// `pushManager.subscribe`, and so does the service worker when a
				// push service rotates an endpoint — a context with no session, so
				// it cannot fetch the key. Inlining it at build time covers both.
				// This is the *public* half; the private key is a Worker secret.
				VITE_VAPID_PUBLIC_KEY: process.env[ "VAPID_PUBLIC_KEY" ] ?? ""
			},
			assets: {
				// Without this, `notFoundHandling` defaults to "none" and every deep
				// link (`/callbreak/<id>/couch`) 404s on a cold load instead of
				// booting the router. An installable app has to survive being
				// launched straight into a URL.
				htmlHandling: "auto-trailing-slash",
				notFoundHandling: "single-page-application"
			}
		} );

		return {
			api: { url: api.url },
			web: { url: web.url },
			db: {
				name: db.databaseName,
				id: db.databaseId
			},
			kv: {
				session: sessionKv.namespaceId,
				webauthn: webauthnKv.namespaceId,
				archive: archiveKv.namespaceId
			}
		};
	} )
);

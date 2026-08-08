import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { default as ApiWorker } from "@/worker.ts";
import { ArchiveKV } from "@/platform/kv/archive.ts";
import { WebAuthnKV } from "@/platform/kv/webauthn.ts";
import { SessionKV } from "@/platform/kv/session.ts";
import { StairwayDatabase } from "@/platform/database/service.ts";

const StairwayStack = Alchemy.Stack(
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
			env: { VITE_API_URL: api.url.as<string>() }
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

export default StairwayStack;
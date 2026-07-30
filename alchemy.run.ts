import { StairwayDatabase } from "@/platform/database/service.ts";
import { SessionKV } from "@/platform/kv/session.ts";
import { default as ApiWorker } from "@/worker.ts";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

const StairwayStack = Alchemy.Stack(
	"Stairway",
	{
		providers: Cloudflare.providers(),
		state: Cloudflare.state()
	},
	Effect.gen( function* () {
		const sessionKv = yield* SessionKV;
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
				session: sessionKv.namespaceId
			}
		};
	} )
);

export default StairwayStack;
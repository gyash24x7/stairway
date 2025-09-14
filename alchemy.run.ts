import type { IAuthRPC } from "@/workers/auth/worker";
import type { ICallbreakRPC } from "@/workers/callbreak/worker";
import type { IFishRPC } from "@/workers/fish/worker";
import type { IWordleRPC } from "@/workers/wordle/worker";
import alchemy, { type } from "alchemy";
import { D1Database, KVNamespace, Vite, Worker } from "alchemy/cloudflare";

const app = await alchemy( "stairway" );

const db = await D1Database( "db", {
	name: "stairway-db",
	migrationsDir: "./migrations"
} );

const webauthnKV = await KVNamespace( "webauthn-kv", {
	title: "webauthn-kv"
} );

export const authWorker = await Worker( "auth", {
	name: "auth-worker",
	entrypoint: "./src/workers/auth/worker.ts",
	compatibilityFlags: [ "nodejs_compat" ],
	rpc: type<IAuthRPC>,
	bindings: {
		WEBAUTHN_KV: webauthnKV,
		WEBAUTHN_RP_ID: alchemy.secret( Bun.env.WEBAUTHN_RP_ID ),
		APP_NAME: "stairway",
		APP_URL: alchemy.secret( Bun.env.APP_URL ),
		DB: db
	}
} );

export const wordleKV = await KVNamespace( "wordle-kv", {
	title: "wordle-kv"
} );

export const wordleWorker = await Worker( "wordle", {
	name: "wordle-worker",
	entrypoint: "./src/workers/wordle/worker.ts",
	compatibilityFlags: [ "nodejs_compat" ],
	rpc: type<IWordleRPC>,
	bindings: {
		WORDLE_KV: wordleKV
	}
} );

export const callbreakKV = await KVNamespace( "callbreak-kv", {
	title: "callbreak-kv"
} );

export const callbreakWorker = await Worker( "callbreak", {
	name: "callbreak-worker",
	entrypoint: "./src/workers/callbreak/worker.ts",
	compatibilityFlags: [ "nodejs_compat" ],
	rpc: type<ICallbreakRPC>,
	bindings: {
		KV: callbreakKV
	}
} );

export const fishKV = await KVNamespace( "fish-kv", {
	title: "fish-kv"
} );

export const fishWorker = await Worker( "fish", {
	name: "fish-worker",
	entrypoint: "./src/workers/fish/worker.ts",
	compatibilityFlags: [ "nodejs_compat" ],
	rpc: type<IFishRPC>,
	bindings: {
		FISH_KV: fishKV
	}
} );

const sessionKV = await KVNamespace( "session-kv", {
	title: "session-kv"
} );

export const webWorker = await Vite( "web", {
	name: "web-worker",
	entrypoint: "./src/workers/web/worker.ts",
	compatibilityFlags: [ "nodejs_compat" ],
	bindings: {
		AUTH_WORKER: authWorker,
		WORDLE_WORKER: wordleWorker,
		CALLBREAK_WORKER: callbreakWorker,
		FISH_WORKER: fishWorker,
		SESSION_KV: sessionKV,
		AUTH_SECRET_KEY: alchemy.secret( Bun.env.AUTH_SECRET_KEY )
	}
} );

await app.finalize();

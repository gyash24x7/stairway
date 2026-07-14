// Project-specific Cloudflare Worker binding types.
//
// `@cloudflare/workers-types/experimental` (referenced in tsconfig.base.json's
// `compilerOptions.types`) provides the `cloudflare:workers` module and the
// Cloudflare runtime globals (DurableObjectState, KVNamespace, D1Database,
// Fetcher, DurableObjectNamespace, ...) plus an intentionally-empty, augmentable
// `Cloudflare.Env` interface. It cannot know this project's bindings, so we
// declare them here — the same role the wrangler-generated env.d.ts used to fill.
//
// Merged into `Cloudflare.Env`, which types `env` from "cloudflare:workers".
declare namespace Cloudflare {
	interface Env {
		DB: D1Database;
		GAMES_KV: KVNamespace;
		AUTH_SECRET_KEY: string;
	}
}

// Bare global `Env` alias (e.g. the AbstractGameEngine DO constructor signature).
type Env = Cloudflare.Env;

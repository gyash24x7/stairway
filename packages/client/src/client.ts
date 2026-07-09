import type { AppRouter } from "./router";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";

// NOTE: `AppRouter` is imported as a *type only* — the server router module (which pulls in
// `cloudflare:workers`, D1, etc.) is erased at build time and never bundled into the client.
const link = new RPCLink( {
	url: `${ window.location.origin }/api`,
	// Send the session cookie with every request.
	fetch: ( request, init ) => fetch( request, { ...init, credentials: "include" } )
} );

/** Fully-typed oRPC client for the whole API, inferred from the server router. */
export const client: RouterClient<AppRouter> = createORPCClient( link );

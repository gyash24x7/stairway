import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { LiteratureRouter } from "@s2h/literature/router";
import superjson from "superjson";

export const client = createTRPCProxyClient<LiteratureRouter>( {
	transformer: superjson,
	links: [
		httpBatchLink( {
			url: "http://localhost:8000/api/literature",
			fetch: ( url, options ) => fetch( url, { ...options, credentials: "include" } )
		} )
	]
} );
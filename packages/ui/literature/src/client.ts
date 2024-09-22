import type { Router } from "@literature/api";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

export const literature = createTRPCClient<Router>( {
	links: [
		httpBatchLink( {
			url: "http://localhost:8000/api/literature",
			fetch: ( input, init ) => fetch( input, { ...init, credentials: "include" } )
		} )
	]
} );
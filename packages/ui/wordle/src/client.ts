import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { Router } from "@wordle/api";

export const wordle = createTRPCClient<Router>( {
	links: [
		httpBatchLink( {
			url: "http://localhost:8000/api/wordle",
			fetch: ( input, init ) => fetch( input, { ...init, credentials: "include" } )
		} )
	]
} );
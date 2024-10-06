import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { Router } from "@wordle/api";

const baseUrl = process.env.NODE_ENV === "development"
	? "http://localhost:8000/api"
	: "/api";

export const client = createTRPCClient<Router>( {
	links: [
		httpBatchLink( {
			url: `${ baseUrl }/wordle`,
			fetch: ( input, init ) => fetch( input, { ...init, credentials: "include" } )
		} )
	]
} );

export type * from "@wordle/api";
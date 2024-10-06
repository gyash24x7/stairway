import type { Router } from "@callbreak/api";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

const baseUrl = process.env.NODE_ENV === "development"
	? "http://localhost:8000/api"
	: "/api";

export const client = createTRPCClient<Router>( {
	links: [
		httpBatchLink( {
			url: `${ baseUrl }/callbreak`,
			fetch: ( input, init ) => fetch( input, { ...init, credentials: "include" } ),
			transformer: superjson
		} )
	]
} );

export type * from "@callbreak/api";
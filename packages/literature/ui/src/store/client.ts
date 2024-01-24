import type { Router } from "@literature/core";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";

const BASE_URL = "http://localhost:8000/api/literature";

export const trpc = createTRPCReact<Router>();

const trpcHttpLink = httpBatchLink( {
	url: BASE_URL,
	fetch: ( input, init ) => fetch( input, { ...init, credentials: "include" } )
} );

export const literatureClient = trpc.createClient( { links: [ trpcHttpLink ] } );

export const vanillaClient = createTRPCClient<Router>( { links: [ trpcHttpLink ] } );
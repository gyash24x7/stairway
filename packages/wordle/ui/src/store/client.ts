import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { Router } from "@wordle/core";

const BASE_URL = "http://localhost:8000/api/wordle";

export const trpc = createTRPCReact<Router>();

const trpcHttpLink = httpBatchLink( {
	url: BASE_URL,
	fetch: ( input, init ) => fetch( input, { ...init, credentials: "include" } )
} );

export const wordleClient = trpc.createClient( { links: [ trpcHttpLink ] } );

export const vanillaClient = createTRPCClient<Router>( { links: [ trpcHttpLink ] } );
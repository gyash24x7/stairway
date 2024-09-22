import { createTRPCClient } from "@trpc/client";
import type { Router } from "@wordle/api";
import { createHttpLink } from "./utils.ts";

export const client = createTRPCClient<Router>( {
	links: [ createHttpLink( "wordle" ) ]
} );

export type * from "@wordle/api";
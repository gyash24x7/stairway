import type { Router } from "@literature/api";
import { createTRPCClient } from "@trpc/client";
import { createHttpLink } from "./utils.ts";

export const client = createTRPCClient<Router>( {
	links: [ createHttpLink( "literature" ) ]
} );

export type * from "@literature/api";

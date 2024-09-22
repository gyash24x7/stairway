import type { Router } from "@literature/api";
import { createTRPCClient } from "@trpc/client";
import { BACKEND_URL, createHttpLink } from "./utils.ts";

export const client = createTRPCClient<Router>( {
	links: [ createHttpLink( "literature" ) ]
} );

export type * from "@literature/api";

export const WS_URL = `${ BACKEND_URL }/literature`;
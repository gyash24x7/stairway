import { httpBatchLink } from "@trpc/client";

export const BACKEND_URL = process.env[ "BACKEND_URL" ] ?? "http://localhost:8000";

export function createHttpLink( path: string ) {
	return httpBatchLink( {
		url: `${ BACKEND_URL }/api/${ path }`,
		fetch: ( input, init ) => fetch( input, { ...init, credentials: "include" } )
	} );
}


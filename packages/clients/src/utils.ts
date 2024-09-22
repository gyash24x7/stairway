import { httpBatchLink } from "@trpc/client";

const baseUrl = process.env.NODE_ENV === "development"
	? "http://localhost:8000/api"
	: "/api";

export function createHttpLink( path: string ) {
	return httpBatchLink( {
		url: `${ baseUrl }/${ path }`,
		fetch: ( input, init ) => fetch( input, { ...init, credentials: "include" } )
	} );
}


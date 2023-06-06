import type { LiteratureRouter } from "@s2h/literature/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { ReactNode } from "react";
import superjson from "superjson";
import { createTRPCProxyClient } from "@trpc/client";

const SERVER_URL = "http://192.168.0.103:8000";

export const trpc = createTRPCReact<LiteratureRouter>();
export const trpcClient = trpc.createClient( {
	transformer: superjson,
	links: [
		httpBatchLink( {
			url: `${ SERVER_URL }/api/literature`,
			fetch: ( input, init ) => fetch( input, { ...init, credentials: "include" } )
		} )
	]
} );

export const client = createTRPCProxyClient<LiteratureRouter>( {
	transformer: superjson,
	links: [
		httpBatchLink( {
			url: "http://192.168.0.103:8000/api/literature",
			fetch: ( url, options ) => fetch( url, { ...options, credentials: "include" } )
		} )
	]
} );

const queryClient = new QueryClient( {
	defaultOptions: {
		queries: { refetchOnWindowFocus: false, retry: false }
	}
} );

export const TrpcProvider = function ( props: { children: ReactNode } ) {
	return (
		<trpc.Provider queryClient={ queryClient } client={ trpcClient }>
			<QueryClientProvider client={ queryClient }>
				{ props.children }
			</QueryClientProvider>
		</trpc.Provider>
	);
};
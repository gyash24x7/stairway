import type { ORPCRouter } from "@/shared/utils/orpc";
import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";

const link = new RPCLink( {
	url: window.location.origin + "/api",
	fetch: ( request, init ) => fetch( request, { ...init, credentials: "include" } ),
	interceptors: [
		onError( ( error ) => {
			console.error( error );
		} )
	],
	plugins: [
		new SimpleCsrfProtectionLinkPlugin()
	]
} );

const client: RouterClient<ORPCRouter> = createORPCClient( link );
export const orpc = createTanstackQueryUtils( client );

export const queryClient = new QueryClient( {
	defaultOptions: {
		queries: {
			refetchInterval: false,
			refetchOnMount: false,
			refetchOnReconnect: false,
			refetchOnWindowFocus: false
		}
	}
} );
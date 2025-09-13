import type { router } from "@/workers/web/router";
import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

const link = new RPCLink( {
	url: "http://localhost:5173/api",
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

const client: RouterClient<typeof router> = createORPCClient( link );
export const orpc = createTanstackQueryUtils( client );
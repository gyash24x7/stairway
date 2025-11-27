import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { ApiClient } from "@s2h/api/router";

const link = new RPCLink( {
	url: window.location.origin + "/api",
	interceptors: [
		onError( ( error ) => {
			console.error( error );
		} )
	],
	plugins: [
		new SimpleCsrfProtectionLinkPlugin()
	]
} );

const client: ApiClient = createORPCClient( link );
export const orpc = createTanstackQueryUtils( client );
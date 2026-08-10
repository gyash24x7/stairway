import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { routeTree } from "@/routeTree.gen.ts";
import { toast } from "@/shared/ui/primitives/sonner.tsx";
import { errorMessage } from "@/shared/ui/utils/errors.ts";
import "@/styles.css";

const queryClient = new QueryClient( {
	mutationCache: new MutationCache( {
		onError: error => {
			toast.error( errorMessage( error ) );
		}
	} ),
	defaultOptions: {
		queries: {
			refetchOnMount: false,
			refetchOnReconnect: false,
			refetchOnWindowFocus: false,
			retry: false
		}
	}
} );

const router = createRouter( {
	routeTree,
	context: { queryClient },
	defaultPreload: "intent"
} );

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}

	interface StaticDataRouteOption {
		/**
		 * Opt this route out of the root `AppLayout` chrome (navbar, centred
		 * gutters). Set by the couch/TV screens, which want the full viewport.
		 * Optional so every other route is unaffected.
		 */
		fullBleed?: boolean;
	}
}

const rootElement = document.getElementById( "root" )!;

createRoot( rootElement ).render(
	<StrictMode>
		<QueryClientProvider client={ queryClient }>
			<RouterProvider router={ router }/>
		</QueryClientProvider>
	</StrictMode>
);

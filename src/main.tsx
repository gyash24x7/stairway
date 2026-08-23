import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { registerServiceWorker } from "@/pwa/client/register.ts";
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
			// The Durable Object broadcasts on *change* and never replays what a
			// disconnected client missed, so a socket that drops and reconnects
			// leaves the cache holding a board several moves stale until the user
			// happens to act. Refetching on reconnect closes that window.
			// `refetchOnWindowFocus` stays off: it would fire on every drawer and
			// dialog, and the couch screen is never focused at all.
			refetchOnReconnect: true,
			refetchOnWindowFocus: false,
			retry: false
		}
	}
} );

const router = createRouter( {
	routeTree,
	context: { queryClient },
	defaultPreload: "intent",

	// A route's params identify the thing it renders, not a detail of how. Two
	// games are two games: without this a match keeps its component instance
	// across `/fish/A` -> `/fish/B`, and every hook that captured the first game
	// carries into the second. Nothing navigated between two ids until rematch
	// did, which is why this went unnoticed.
	defaultRemountDeps: ( { params } ) => params
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

// After render: `registerSW` defers to `window.load`, by which point the
// toaster it reports through is mounted.
registerServiceWorker();

createRoot( rootElement ).render(
	<StrictMode>
		<QueryClientProvider client={ queryClient }>
			<RouterProvider router={ router }/>
		</QueryClientProvider>
	</StrictMode>
);

import { routeTree } from "@/routeTree.gen";
import "@/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const queryClient = new QueryClient( {
	defaultOptions: {
		queries: {
			// Game/auth state is fetched on demand; refetch-on-focus adds noise.
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
}

const rootElement = document.getElementById( "root" )!;

createRoot( rootElement ).render(
	<StrictMode>
		<QueryClientProvider client={ queryClient }>
			<RouterProvider router={ router }/>
		</QueryClientProvider>
	</StrictMode>
);

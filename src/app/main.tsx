import { queryClient } from "@/app/client/query";
import { routeTree } from "@/app/route-tree";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const router = createRouter( { routeTree, context: { queryClient } } );

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById( "root" )!;
const root = createRoot( rootElement );
root.render(
	<StrictMode>
		<QueryClientProvider client={ queryClient }>
			<RouterProvider router={ router }/>
		</QueryClientProvider>
	</StrictMode>
);

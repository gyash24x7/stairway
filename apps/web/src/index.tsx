import { ClerkProvider } from "@clerk/clerk-react";
import { homeRoute, rootRoute, theme } from "@common/ui";
import { literatureRouteTree } from "@literature/ui";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, RouterProvider } from "@tanstack/react-router";
import { wordleRouteTree } from "@wordle/ui";
import * as ReactDOM from "react-dom/client";

const PUBLISHABLE_KEY = import.meta.env[ "VITE_CLERK_PUBLISHABLE_KEY" ];

if ( !PUBLISHABLE_KEY ) {
	throw new Error( "Missing Publishable Key" );
}

const routeTree = rootRoute.addChildren( [ homeRoute, literatureRouteTree, wordleRouteTree ] );

export const router = new Router( { routeTree } );

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const queryClient = new QueryClient();
const root = ReactDOM.createRoot( document.getElementById( "root" ) as HTMLElement );

root.render(
	<ClerkProvider publishableKey={ PUBLISHABLE_KEY }>
		<QueryClientProvider client={ queryClient }>
			<MantineProvider theme={ theme }>
				<RouterProvider router={ router }/>
			</MantineProvider>
		</QueryClientProvider>
	</ClerkProvider>
);

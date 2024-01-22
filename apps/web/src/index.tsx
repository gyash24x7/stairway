import { homeRoute, rootRoute, theme } from "@common/ui";
import { literatureRouteTree } from "@literature/ui";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { Router, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";

const routeTree = rootRoute.addChildren( [ homeRoute, literatureRouteTree ] );

export const router = new Router( { routeTree } );

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const root = ReactDOM.createRoot( document.getElementById( "root" ) as HTMLElement );

root.render(
	<StrictMode>
		<MantineProvider theme={ theme }>
			<RouterProvider router={ router }/>
		</MantineProvider>
	</StrictMode>
);

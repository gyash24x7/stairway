import { literatureRoute } from "@literature/ui";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { authStoreLoader, homeRoute, theme } from "@s2h/ui";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

const root = ReactDOM.createRoot( document.getElementById( "root" ) as HTMLElement );

export const router = createBrowserRouter( [
	{
		path: "/",
		element: <Outlet/>,
		children: [ literatureRoute, homeRoute ],
		loader: authStoreLoader
	}
] );

root.render(
	<StrictMode>
		<MantineProvider theme={ theme }>
			<RouterProvider router={ router }/>
		</MantineProvider>
	</StrictMode>
);

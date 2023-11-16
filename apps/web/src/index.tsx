import { authStoreLoader } from "@auth/ui";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { ErrorPage, theme } from "@s2h/ui";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, Outlet, RouteObject, RouterProvider } from "react-router-dom";
import { homeRoute } from "./pages";
import { literatureHomeRoute } from "./pages/literature";
import { literatureGameRoute } from "./pages/literature/game";

const root = ReactDOM.createRoot( document.getElementById( "root" ) as HTMLElement );

export const literatureRoute: RouteObject = {
	path: "literature",
	element: <Outlet/>,
	errorElement: <ErrorPage/>,
	children: [ literatureGameRoute, literatureHomeRoute ]
};


const rootRoute: RouteObject = {
	path: "/",
	element: <Outlet/>,
	errorElement: <ErrorPage/>,
	children: [ literatureRoute, homeRoute ],
	loader: authStoreLoader
};

export const router = createBrowserRouter( [ rootRoute ] );

root.render(
	<StrictMode>
		<MantineProvider theme={ theme }>
			<RouterProvider router={ router }/>
		</MantineProvider>
	</StrictMode>
);

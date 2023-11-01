import { authRoute, authStoreLoader, PrivateLayout } from "@auth/ui";
import { literatureRoute } from "@literature/ui";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { ErrorPage, HomePage, HomePageFooter, theme } from "@s2h/ui";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, IndexRouteObject, Outlet, RouteObject, RouterProvider } from "react-router-dom";

const root = ReactDOM.createRoot( document.getElementById( "root" ) as HTMLElement );

const homeRoute: IndexRouteObject = {
	index: true,
	element: <PrivateLayout footer={ <HomePageFooter/> }><HomePage/></PrivateLayout>,
	errorElement: <ErrorPage/>
};

const rootRoute: RouteObject = {
	path: "/",
	element: <Outlet/>,
	errorElement: <ErrorPage/>,
	children: [ authRoute, literatureRoute, homeRoute ],
	loader: authStoreLoader
};

const router = createBrowserRouter( [ rootRoute ] );

root.render(
	<StrictMode>
		<MantineProvider theme={ theme }>
			<RouterProvider router={ router }/>
		</MantineProvider>
	</StrictMode>
);

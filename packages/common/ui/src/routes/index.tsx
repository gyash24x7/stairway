import { AppShell } from "@mantine/core";
import { Outlet, RootRoute, Route } from "@tanstack/react-router";
import { authStoreLoader } from "../auth";
import { AppHeader, ErrorPage, HomePage } from "../components";

function RootLayout() {
	return (
		<AppShell>
			<AppHeader/>
			<Outlet/>
		</AppShell>
	);
}

export const rootRoute = new RootRoute( {
	component: () => <RootLayout/>,
	loader: authStoreLoader
} );

export const homeRoute = new Route( {
	path: "/",
	getParentRoute: () => rootRoute,
	component: () => <HomePage/>,
	errorComponent: () => <ErrorPage/>
} );
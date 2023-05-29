import { AuthProvider, GameProvider, TrpcProvider } from "../utils";
import { GamePage, HomePage } from "../pages";
import { Outlet, RootRoute, Route, Router, RouterProvider } from "@tanstack/router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

const rootRoute = new RootRoute( { component: Outlet } );
const homeRoute = new Route( { path: "/", component: HomePage, getParentRoute: () => rootRoute } );
const gameRoute = new Route( {
	path: "$gameId",
	component: () => (
		<GameProvider>
			<GamePage/>
		</GameProvider>
	),
	getParentRoute: () => rootRoute
} );

const routeTree = rootRoute.addChildren( [ homeRoute, gameRoute ] );
export const router = new Router( { routeTree } );

declare module "@tanstack/router" {
	interface Register {
		router: typeof router;
	}
}

export function LiteratureApp() {
	return (
		<TrpcProvider>
			<AuthProvider>
				<RouterProvider router={ router }/>
				<TanStackRouterDevtools router={ router } initialIsOpen={ false }/>
			</AuthProvider>
		</TrpcProvider>
	);
}

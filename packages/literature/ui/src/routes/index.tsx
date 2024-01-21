import { ErrorPage, rootRoute } from "@common/ui";
import { gameStoreLoader } from "@literature/store";
import { Outlet, Route } from "@tanstack/react-router";
import { GamePage, HomePage } from "../pages";

export const literatureRoute = new Route( {
	path: "literature",
	getParentRoute: () => rootRoute,
	component: () => <Outlet/>,
	errorComponent: () => <ErrorPage/>
} );

export const literatureHomeRoute = new Route( {
	path: "/",
	getParentRoute: () => literatureRoute,
	component: () => <HomePage/>,
	errorComponent: () => <ErrorPage/>
} );

export const literatureGameRoute = new Route( {
	path: "$gameId",
	getParentRoute: () => literatureRoute,
	component: () => <GamePage/>,
	errorComponent: () => <ErrorPage/>,
	loader: ( { params } ) => gameStoreLoader( { params } )
} );

export const literatureRouteTree = literatureRoute.addChildren( [ literatureHomeRoute, literatureGameRoute ] );
import { ErrorPage, rootRoute } from "@common/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, Route } from "@tanstack/react-router";
import { GamePage, HomePage } from "../pages";
import { gameStoreLoader, literatureClient, trpc } from "../store";

function LiteratureLayout() {
	const queryClient = useQueryClient();

	return (
		<trpc.Provider client={ literatureClient } queryClient={ queryClient }>
			<Outlet/>
		</trpc.Provider>
	);
}

export const literatureRoute = new Route( {
	path: "literature",
	getParentRoute: () => rootRoute,
	component: () => <LiteratureLayout/>,
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
	loader: ( { params } ) => gameStoreLoader( params.gameId )
} );

export const literatureRouteTree = literatureRoute.addChildren( [ literatureHomeRoute, literatureGameRoute ] );
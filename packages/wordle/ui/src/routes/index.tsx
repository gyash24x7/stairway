import { ErrorPage, rootRoute } from "@common/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, Route } from "@tanstack/react-router";
import { GamePage, HomePage } from "../pages";
import { gameStoreLoader, trpc, wordleClient } from "../store";

function WordleLayout() {
	const queryClient = useQueryClient();

	return (
		<trpc.Provider client={ wordleClient } queryClient={ queryClient }>
			<Outlet/>
		</trpc.Provider>
	);
}

export const wordleRoute = new Route( {
	path: "wordle",
	getParentRoute: () => rootRoute,
	component: () => <WordleLayout/>,
	errorComponent: () => <ErrorPage/>
} );

export const wordleHomeRoute = new Route( {
	path: "/",
	getParentRoute: () => wordleRoute,
	component: () => <HomePage/>,
	errorComponent: () => <ErrorPage/>
} );

export const wordleGameRoute = new Route( {
	path: "$gameId",
	getParentRoute: () => wordleRoute,
	component: () => <GamePage/>,
	errorComponent: () => <ErrorPage/>,
	loader: ( { params } ) => gameStoreLoader( params.gameId )
} );

export const wordleRouteTree = wordleRoute.addChildren( [ wordleHomeRoute, wordleGameRoute ] );
import { type IAuthContext, useAuth } from "@s2h-ui/auth/context";
import { CallbreakGamePage } from "@s2h-ui/callbreak/game-page";
import { CallbreakHomePage } from "@s2h-ui/callbreak/home-page";
import { FishGamePage } from "@s2h-ui/fish/game-page";
import { FishHomePage } from "@s2h-ui/fish/home-page";
import { HomePage } from "@s2h-ui/shared/home-page";
import { Shell } from "@s2h-ui/shared/shell";
import { SplendorGamePage } from "@s2h-ui/splendor/game-page";
import { SplendorHomePage } from "@s2h-ui/splendor/home-page";
import { WordleGamePage } from "@s2h-ui/wordle/game-page";
import { WordleHomePage } from "@s2h-ui/wordle/home-page";
import * as callbreak from "@s2h/client/callbreak";
import * as fish from "@s2h/client/fish";
import * as splendor from "@s2h/client/splendor";
import * as wordle from "@s2h/client/wordle";
import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	redirect,
	RouterProvider
} from "@tanstack/react-router";

const rootRoute = createRootRouteWithContext<IAuthContext>()( {
	component: Shell
} );

const indexRoute = createRoute( {
	getParentRoute: () => rootRoute,
	path: "/",
	component: HomePage
} );

const wordleHomeRoute = createRoute( {
	getParentRoute: () => rootRoute,
	path: "/wordle",
	component: WordleHomePage
} );

const wordleGameRoute = createRoute( {
	getParentRoute: () => rootRoute,
	path: "/wordle/$gameId",
	loader: ( { params } ) => wordle.ensureGetGameQueryData( params.gameId ),
	beforeLoad: ( { context } ) => {
		if ( !context.isLoggedIn ) {
			throw redirect( { to: "/wordle" } );
		}
	},
	component: () => {
		const data = wordleGameRoute.useLoaderData();
		return <WordleGamePage data={ data! }/>;
	}
} );

const callbreakHomeRoute = createRoute( {
	getParentRoute: () => rootRoute,
	path: "/callbreak",
	component: CallbreakHomePage
} );

const callbreakGameRoute = createRoute( {
	getParentRoute: () => rootRoute,
	path: "/callbreak/$gameId",
	loader: ( { params } ) => callbreak.ensureGetGameQueryData( params.gameId ),
	beforeLoad: ( { context } ) => {
		if ( !context.isLoggedIn ) {
			throw redirect( { to: "/callbreak" } );
		}
	},
	component: () => {
		const data = callbreakGameRoute.useLoaderData();
		return <CallbreakGamePage data={ data }/>;
	}
} );


const fishHomeRoute = createRoute( {
	getParentRoute: () => rootRoute,
	path: "/fish",
	component: FishHomePage
} );

const fishGameRoute = createRoute( {
	getParentRoute: () => rootRoute,
	path: "/fish/$gameId",
	loader: ( { params } ) => fish.ensureGetGameQueryData( params.gameId ),
	beforeLoad: ( { context } ) => {
		if ( !context.isLoggedIn ) {
			throw redirect( { to: "/fish" } );
		}
	},
	component: () => {
		const data = fishGameRoute.useLoaderData();
		return <FishGamePage data={ data }/>;
	}
} );

const splendorHomeRoute = createRoute( {
	getParentRoute: () => rootRoute,
	path: "/splendor",
	component: SplendorHomePage
} );

const splendorGameRoute = createRoute( {
	getParentRoute: () => rootRoute,
	path: "/splendor/$gameId",
	loader: ( { params } ) => splendor.ensureGetGameQueryData( params.gameId ),
	beforeLoad: ( { context } ) => {
		if ( !context.isLoggedIn ) {
			throw redirect( { to: "/splendor" } );
		}
	},
	component: () => {
		const data = splendorGameRoute.useLoaderData();
		return <SplendorGamePage data={ data }/>;
	}
} );

const routeTree = rootRoute.addChildren( [
	indexRoute,
	wordleHomeRoute,
	wordleGameRoute,
	callbreakHomeRoute,
	callbreakGameRoute,
	fishHomeRoute,
	fishGameRoute,
	splendorHomeRoute,
	splendorGameRoute
] );

export const router = createRouter( { routeTree, context: { authInfo: null, isLoggedIn: false } } );

export function AppRoutes() {
	const auth = useAuth();
	return <RouterProvider router={ router } context={ auth }/>;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
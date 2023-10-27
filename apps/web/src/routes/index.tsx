import { authClient, AuthProvider, LoginPage, SignUpPage } from "@auth/ui";
import { GamePage, GameProvider, HomePage as LiteratureHomePage, literatureClient } from "@literature/ui";
import { ErrorPage } from "@s2h/ui";
import { createBrowserRouter, IndexRouteObject, Outlet, RouteObject } from "react-router-dom";
import { HomePage } from "../components";
import { AuthGateway } from "./auth-gateway";

const loginRoute: RouteObject = {
	path: "login",
	element: <LoginPage/>,
	errorElement: <ErrorPage/>
};

const signUpRoute: RouteObject = {
	path: "signup",
	element: <SignUpPage/>,
	errorElement: <ErrorPage/>
};

const authRoute: RouteObject = {
	path: "auth",
	element: <AuthGateway><Outlet/></AuthGateway>,
	errorElement: <ErrorPage/>,
	children: [ loginRoute, signUpRoute ]
};

const literatureHomeRoute: IndexRouteObject = {
	index: true,
	element: <LiteratureHomePage/>,
	errorElement: <ErrorPage/>
};

const literatureGameRoute: RouteObject = {
	path: ":gameId",
	element: <GameProvider><GamePage/></GameProvider>,
	errorElement: <ErrorPage/>,
	loader: async ( { params } ) => {
		const gameId = params[ "gameId" ]!;
		const gameData = await literatureClient.loadGameData( { gameId } );
		const playerData = await literatureClient.loadPlayerData( { gameId } );
		return { gameData, playerData };
	}
};

const literatureRoute: RouteObject = {
	path: "literature",
	element: <AuthGateway isPrivate><Outlet/></AuthGateway>,
	errorElement: <ErrorPage/>,
	children: [ literatureGameRoute, literatureHomeRoute ]
};

const homeRoute: IndexRouteObject = {
	index: true,
	element: <AuthGateway isPrivate><HomePage/></AuthGateway>,
	errorElement: <ErrorPage/>
};

const rootRoute: RouteObject = {
	path: "/",
	element: <AuthProvider><Outlet/></AuthProvider>,
	errorElement: <ErrorPage/>,
	children: [ authRoute, literatureRoute, homeRoute ],
	loader: authClient.loadAuthInfo
};

export const router = createBrowserRouter( [ rootRoute ] );

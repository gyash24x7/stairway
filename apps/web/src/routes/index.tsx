import { authClient, AuthProvider, LoginPage, SignUpPage } from "@auth/ui";
import {
	GamePage,
	GamePageFooter as LiteratureGamePageFooter,
	GameProvider,
	HomePage as LiteratureHomePage,
	HomePageFooter as LiteratureHomePageFooter,
	literatureClient
} from "@literature/ui";
import { ErrorPage } from "@s2h/ui";
import { createBrowserRouter, IndexRouteObject, Outlet, RouteObject } from "react-router-dom";
import { HomePage, HomePageFooterHeading } from "../components";
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
	element: (
		<AuthGateway isPrivate footer={ <LiteratureHomePageFooter/> }>
			<LiteratureHomePage/>
		</AuthGateway>
	),
	errorElement: <ErrorPage/>
};

const literatureGameRoute: RouteObject = {
	path: ":gameId",
	element: (
		<GameProvider>
			<AuthGateway isPrivate footer={ <LiteratureGamePageFooter/> }>
				<GamePage/>
			</AuthGateway>
		</GameProvider>
	),
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
	element: <Outlet/>,
	errorElement: <ErrorPage/>,
	children: [ literatureGameRoute, literatureHomeRoute ]
};

const homeRoute: IndexRouteObject = {
	index: true,
	element: <AuthGateway isPrivate footer={ <HomePageFooterHeading/> }><HomePage/></AuthGateway>,
	errorElement: <ErrorPage/>
};

const rootRoute: RouteObject = {
	path: "/",
	element: <AuthProvider><Outlet/></AuthProvider>,
	errorElement: <ErrorPage/>,
	children: [ authRoute, literatureRoute, homeRoute ],
	loader: async () => {
		const authInfo = await authClient.loadAuthInfo();
		if ( !!authInfo ) {
			const { token } = await authClient.getToken();
			localStorage.setItem( "authToken", token );
		}

		return authInfo;
	}
};

export const router = createBrowserRouter( [ rootRoute ] );

import { AuthLayout, authStoreLoader, LoginPage, SignUpPage } from "@auth/ui";
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
import { AppLayout, HomePage, HomePageFooter } from "../components";
import { AuthGateway } from "./auth-gateway";

const loginRoute: RouteObject = {
	path: "login",
	element: <AuthLayout><LoginPage/></AuthLayout>,
	errorElement: <ErrorPage/>
};

const signUpRoute: RouteObject = {
	path: "signup",
	element: <AuthLayout><SignUpPage/></AuthLayout>,
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
	element: <AppLayout footer={ <LiteratureHomePageFooter/> }><LiteratureHomePage/></AppLayout>,
	errorElement: <ErrorPage/>
};

const literatureGameRoute: RouteObject = {
	path: ":gameId",
	element: (
		<GameProvider>
			<AppLayout footer={ <LiteratureGamePageFooter/> }>
				<GamePage/>
			</AppLayout>
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
	element: <AuthGateway isPrivate><Outlet/></AuthGateway>,
	errorElement: <ErrorPage/>,
	children: [ literatureGameRoute, literatureHomeRoute ]
};

const homeRoute: IndexRouteObject = {
	index: true,
	element: <AuthGateway isPrivate><AppLayout footer={ <HomePageFooter/> }><HomePage/></AppLayout></AuthGateway>,
	errorElement: <ErrorPage/>
};

const rootRoute: RouteObject = {
	path: "/",
	element: <Outlet/>,
	errorElement: <ErrorPage/>,
	children: [ authRoute, literatureRoute, homeRoute ],
	loader: authStoreLoader
};

export const router = createBrowserRouter( [ rootRoute ] );

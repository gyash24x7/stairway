import { Outlet, RouteObject } from "react-router-dom";
import { ErrorPage, GamePage, HomePage } from "../pages";
import { AuthProvider, GameProvider, TrpcProvider } from "../utils";
import { client } from "../../../client/src/client";

export const homeRoute: RouteObject = {
	id: "home",
	index: true,
	element: <HomePage/>,
	errorElement: <ErrorPage/>
};

export const gameRoute: RouteObject = {
	id: "literature",
	path: ":gameId",
	element: <GameProvider><GamePage/></GameProvider>,
	errorElement: <ErrorPage/>,
	async loader( { params } ) {
		return client.getGame.query( { gameId: params[ "gameId" ]! } );
	}
};

export const rootRoute: RouteObject = {
	id: "root",
	path: "/",
	element: <TrpcProvider><AuthProvider><Outlet/></AuthProvider></TrpcProvider>,
	children: [ homeRoute, gameRoute ],
	async loader() {
		return fetch( `http://localhost:8000/api/me`, { credentials: "include" } )
			.then( res => res.json() )
			.catch( () => null );
	}
};
import { ErrorPage } from "@s2h/ui";
import type { IndexRouteObject, RouteObject } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { GamePage, HomePage } from "../pages";
import { gameStoreLoader } from "../store";

const literatureHomeRoute: IndexRouteObject = {
	index: true,
	element: <HomePage/>,
	errorElement: <ErrorPage/>
};

const literatureGameRoute: RouteObject = {
	path: ":gameId",
	element: <GamePage/>,
	errorElement: <ErrorPage/>,
	loader: gameStoreLoader
};

export const literatureRoute: RouteObject = {
	path: "literature",
	element: <Outlet/>,
	errorElement: <ErrorPage/>,
	children: [ literatureGameRoute, literatureHomeRoute ]
};
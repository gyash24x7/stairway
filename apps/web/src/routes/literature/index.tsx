import { ErrorPage } from "@common/ui";
import { Outlet, RouteObject } from "react-router-dom";
import { literatureGameRoute } from "./game-page.js";
import { literatureHomeRoute } from "./home-page.js";

export const literatureRoute: RouteObject = {
	path: "literature",
	element: <Outlet/>,
	errorElement: <ErrorPage/>,
	children: [ literatureGameRoute, literatureHomeRoute ]
};
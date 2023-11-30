import { ErrorPage } from "@common/ui";
import { Outlet, RouteObject } from "react-router-dom";
import { literatureGameRoute } from "./game-page";
import { literatureHomeRoute } from "./home-page";

export const literatureRoute: RouteObject = {
	path: "literature",
	element: <Outlet/>,
	errorElement: <ErrorPage/>,
	children: [ literatureGameRoute, literatureHomeRoute ]
};
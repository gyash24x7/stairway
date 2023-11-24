import { authStoreLoader } from "@auth/store";
import type { RouteObject } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { homeRoute } from "./home-page.js";
import { literatureRoute } from "./literature/index.js";

export const rootRoute: RouteObject = {
	path: "/",
	element: <Outlet/>,
	children: [ literatureRoute, homeRoute ],
	loader: authStoreLoader
};
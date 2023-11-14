import { ErrorPage } from "@s2h/ui";
import type { RouteObject } from "react-router-dom";
import { LoginPage } from "../components";

export const loginRoute: RouteObject = {
	path: "login",
	element: <LoginPage/>,
	errorElement: <ErrorPage/>
};
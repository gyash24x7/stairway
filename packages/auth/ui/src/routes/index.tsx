import { ErrorPage } from "@s2h/ui";
import { Outlet, RouteObject } from "react-router-dom";
import { LoginPage, PublicLayout, SignUpPage } from "../components";

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

export const authRoute: RouteObject = {
	path: "auth",
	element: <PublicLayout><Outlet/></PublicLayout>,
	errorElement: <ErrorPage/>,
	children: [ loginRoute, signUpRoute ]
};
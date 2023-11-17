import type { IndexRouteObject } from "react-router-dom";
import { ErrorPage, HomePage } from "../pages";

export const homeRoute: IndexRouteObject = {
	index: true,
	element: <HomePage/>,
	errorElement: <ErrorPage/>
};
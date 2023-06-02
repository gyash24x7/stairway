import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { rootRoute } from "./routes";

export const router = createBrowserRouter( [ rootRoute ] );

export function LiteratureApp() {
	return <RouterProvider router={ router }/>;
}

export * from "./routes";

import type { UserAuthInfo } from "@auth/api";
import { Spinner } from "@base/ui";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen.ts";

import "@fontsource/bungee-spice/400.css";
import "@fontsource/fjalla-one/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/900.css";
import "./styles.css";

const router = createRouter( { routeTree } );

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const fetchAuthInfo = async () => {
	const res = await fetch( "http://localhost:8000/api/auth/user", { credentials: "include" } );
	if ( res.status === 200 ) {
		const authInfo: UserAuthInfo | undefined = await res.json().catch();
		return authInfo;
	}

	return undefined;
};

const App = () => {
	const { data, isPending, isError, error } = useQuery( {
		queryKey: [ "user" ],
		queryFn: () => fetchAuthInfo()
	} );

	if ( isPending ) {
		return (
			<div className={ "w-screen h-screen flex justify-center items-center" }>
				<Spinner/>
			</div>
		);
	}

	if ( isError ) {
		return (
			<div className={ "w-screen h-screen flex justify-center items-center" }>
				<h2 className={ "font-fjalla text-xl" }>{ error.message }</h2>
			</div>
		);
	}

	return <RouterProvider router={ router } context={ { authInfo: data } }/>;
};

const queryClient = new QueryClient( {
	defaultOptions: {
		queries: {
			refetchOnMount: false,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false
		}
	}
} );

const rootEl = document.getElementById( "root" )!;
const root = ReactDOM.createRoot( rootEl );

root.render(
	<React.StrictMode>
		<QueryClientProvider client={ queryClient }>
			<App/>
		</QueryClientProvider>
	</React.StrictMode>
);

import { Spinner } from "@base/components";
import { client } from "@stairway/clients/auth";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen.ts";

import "@fontsource/bungee-spice/latin-400.css";
import "@fontsource/fjalla-one/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-900.css";
import "./styles.css";

const router = createRouter( { routeTree, context: { authInfo: null } } );

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const App = () => {
	const { data, isPending, isError, error } = useQuery( {
		queryKey: [ "user" ],
		queryFn: () => client.fetchAuthInfo()
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

import { Spinner } from "@base/components";
import { useSession } from "@stairway/clients/auth";
import { queryClient } from "@stairway/clients/query.client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { routeTree } from "./routeTree.gen";

import "@fontsource/fjalla-one/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-900.css";
import "./styles.css";

const router = createRouter( {
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
	defaultStructuralSharing: true,
	context: { authInfo: null, queryClient }
} );

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const App = () => {
	const { data, isPending, error } = useSession();

	if ( !!error ) {
		return (
			<div className={ "w-screen h-screen flex justify-center items-center" }>
				<h2 className={ "font-fjalla text-xl" }>{ error.message }</h2>
			</div>
		);
	}

	if ( isPending ) {
		return (
			<div className={ "w-screen h-screen flex justify-center items-center" }>
				<Spinner/>
			</div>
		);
	}

	return (
		<RouterProvider
			router={ router }
			context={ { authInfo: !!data?.user ? { ...data.user, avatar: data.user.image ?? "" } : null } }
		/>
	);
};

const rootEl = document.getElementById( "root" )!;
const root = ReactDOM.createRoot( rootEl );

root.render(
	<QueryClientProvider client={ queryClient }>
		<App/>
	</QueryClientProvider>
);

import { orpc } from "@/app/client/orpc";
import { Navbar } from "@/app/components/shared/navbar";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

type RouterContext = { queryClient: QueryClient };
export const Route = createRootRouteWithContext<RouterContext>()( {
	loader: ( { context } ) => context.queryClient.ensureQueryData( orpc.auth.authInfo.queryOptions() ),
	component: () => {
		const authInfo = Route.useLoaderData();
		return (
			<main className="flex min-h-screen flex-col bg-bg">
				<Navbar authInfo={ authInfo }/>
				<div className={ "px-2 py-2 md:px-4 md:py-4 md:mt-[100px] mt-[76px]" }>
					<Outlet/>
				</div>
				<TanStackRouterDevtools/>
				<ReactQueryDevtools/>
			</main>
		);
	}
} );
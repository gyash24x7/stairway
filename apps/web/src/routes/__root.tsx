import { RAuthInfo } from "@s2h-ui/auth/auth-info";
import { Login } from "@s2h-ui/auth/login";
import { useAuth } from "@s2h-ui/auth/use-auth";
import { Navbar } from "@s2h/ui/components/navbar";
import { cn } from "@s2h/ui/utils/cn";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

/** Root route: carries the QueryClient in router context and wraps pages in the app layout. */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()( {
	component: () => {
		const { authInfo } = useAuth();
		return (
			<main className="flex min-h-screen flex-col bg-surface">
				<Navbar>
					{ !authInfo ? <Login/> : <RAuthInfo authInfo={ authInfo }/> }
				</Navbar>
				<div
					className={ cn(
						"px-2 py-2 md:px-4 md:py-4 md:mt-20",
						"mt-15 w-full flex justify-center"
					) }
				>
					<Outlet/>
				</div>
			</main>
		);
	}
} );

import type { UserAuthInfo } from "@auth/api";
import { Toaster } from "@base/components";
import { LoginButton, Navbar } from "@main/components";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

type RouterContext = {
	authInfo: UserAuthInfo | null;
}

export const Route = createRootRouteWithContext<RouterContext>()( {
	component: () => {
		const { authInfo } = Route.useRouteContext();
		return (
			<main className="flex min-h-screen flex-col bg-background">
				<Navbar/>
				<div className={ "px-3 md:px-5 lg:mt-44 xl:mt-48 md:mt-40 mt-36" }>
					{ !authInfo && <LoginButton/> }
					<Outlet/>
				</div>
				<Toaster expand richColors/>
			</main>
		);
	}
} );
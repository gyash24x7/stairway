import { LoginButton } from "@/components/login-button.tsx";
import { Navbar } from "@/components/navbar.tsx";
import type { UserAuthInfo } from "@stairway/clients/auth";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

type RouterContext = {
	authInfo: UserAuthInfo | null;
}

export const Route = createRootRouteWithContext<RouterContext>()( {
	component: () => {
		const { authInfo } = Route.useRouteContext();
		return (
			<main className="flex min-h-screen flex-col">
				<Navbar/>
				<div className={ "px-3 md:px-5 lg:mt-44 xl:mt-48 md:mt-40 mt-36" }>
					{ !authInfo && <LoginButton/> }
					<Outlet/>
				</div>
			</main>
		);
	}
} );
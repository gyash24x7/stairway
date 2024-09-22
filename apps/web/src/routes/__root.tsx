import { DisplayAuthInfo } from "@/components/display-auth-info.tsx";
import { Navbar } from "@/components/navbar.tsx";
import type { UserAuthInfo } from "@auth/api";
import { Separator } from "@base/ui";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRouteWithContext<{ authInfo?: UserAuthInfo }>()( {
	component: () => {
		const { authInfo } = Route.useRouteContext();
		return (
			<main className="flex min-h-screen flex-col p-10">
				<div className={ "flex justify-between items-center" }>
					<div>
						<p className={ `text-lg md:text-xl font-bold` }>LET'S PLAY!</p>
						<h1 className={ `text-6xl md:text-8xl font-bold font-bungee` }>STAIRWAY</h1>
					</div>
					<DisplayAuthInfo authInfo={ authInfo }/>
				</div>
				<Navbar authInfo={ authInfo }/>
				<Separator className={ "mb-10" }/>
				<Outlet/>
				<TanStackRouterDevtools/>
			</main>
		);
	}
} );
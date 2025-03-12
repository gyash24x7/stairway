import { Button, Toaster } from "@base/components";
import { EnterIcon } from "@radix-ui/react-icons";
import { login } from "@stairway/clients/auth";
import { Navbar } from "@main/components";
import type { Auth } from "@stairway/types/auth";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Fragment } from "react";

type RouterContext = {
	authInfo: Auth.Info | null;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()( {
	component: () => {
		const { authInfo } = Route.useRouteContext();
		return (
			<main className="flex min-h-screen flex-col bg-background">
				<Navbar/>
				<div className={ "px-3 md:px-5 lg:mt-44 xl:mt-48 md:mt-40 mt-36" }>
					{ !authInfo && (
						<Button className={ "flex gap-2 items-center w-full mb-4" } onClick={ login }>
							<Fragment>LOGIN</Fragment>
							<EnterIcon fontWeight={ "bold" } className={ "w-4 h-4" }/>
						</Button>
					) }
					<Outlet/>
				</div>
				<Toaster expand richColors/>
			</main>
		);
	}
} );
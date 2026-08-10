import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet, useMatches } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";

import { RAuthInfo } from "@/auth/client/auth-info.tsx";
import { Login } from "@/auth/client/login.tsx";
import { useAuth } from "@/auth/client/use-auth.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Navbar } from "@/shared/ui/components/navbar.tsx";
import { Toaster } from "@/shared/ui/primitives/sonner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

function AppLayout( { children }: { children: ReactNode } ) {
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
				{ children }
			</div>
			<Toaster position={ "top-center" } duration={ 4000 }/>
		</main>
	);
}

/**
 * The app shell, unless a matched route asks to skip it. A couch/TV screen renders
 * edge to edge — a navbar and centred gutters are wasted space across a room — so
 * it sets `staticData.fullBleed` and gets only the outlet plus toasts.
 */
function RootLayout() {
	const fullBleed = useMatches( {
		select: matches => matches.some( match => match.staticData.fullBleed === true )
	} );

	if ( fullBleed ) {
		return (
			<Fragment>
				<Outlet/>
				<Toaster position={ "top-center" } duration={ 4000 }/>
			</Fragment>
		);
	}

	return (
		<AppLayout>
			<Outlet/>
		</AppLayout>
	);
}

/** Root route: carries the QueryClient in router context and wraps pages in the app layout. */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()( {
	component: RootLayout,

	// Errors and 404s keep the chrome even on a couch route: a TV showing an error
	// with a way back home beats a bare black screen.
	errorComponent: ( { error } ) => (
		<AppLayout>
			<ErrorState error={ error } action={ { label: "BACK HOME", to: "/" } }/>
		</AppLayout>
	),

	notFoundComponent: () => (
		<AppLayout>
			<ErrorState
				title={ "Page not found" }
				message={ "That page doesn't exist." }
				action={ { label: "BACK HOME", to: "/" } }
			/>
		</AppLayout>
	)
} );

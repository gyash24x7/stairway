import { AppLayout } from "@/shared/components/layout";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

/** Root route: carries the QueryClient in router context and wraps pages in the app layout. */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()( {
	component: () => (
		<AppLayout>
			<Outlet/>
		</AppLayout>
	)
} );

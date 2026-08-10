import { createFileRoute } from "@tanstack/react-router";

import { SplendorControllerPage } from "@/games/splendor/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";

// No `fullBleed`: a phone wants the navbar (log out, theme, home).
export const Route = createFileRoute( "/splendor/$gameId/controller" )( {
	component: ControllerRoute
} );

function ControllerRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<SplendorControllerPage gameId={ gameId }/>
		</RequireSession>
	);
}

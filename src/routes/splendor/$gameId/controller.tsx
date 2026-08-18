import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { SplendorControllerPage } from "@/games/splendor/client/controller-page.tsx";

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

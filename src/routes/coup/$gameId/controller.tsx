import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { CoupControllerPage } from "@/games/coup/client/controller-page.tsx";

export const Route = createFileRoute( "/coup/$gameId/controller" )( {
	component: ControllerRoute
} );

function ControllerRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<CoupControllerPage gameId={ gameId }/>
		</RequireSession>
	);
}

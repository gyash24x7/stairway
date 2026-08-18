import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { CallbreakControllerPage } from "@/games/callbreak/client/controller-page.tsx";

export const Route = createFileRoute( "/callbreak/$gameId/controller" )( {
	component: ControllerRoute
} );

function ControllerRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<CallbreakControllerPage gameId={ gameId }/>
		</RequireSession>
	);
}

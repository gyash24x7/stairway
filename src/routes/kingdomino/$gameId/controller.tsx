import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { KingdominoControllerPage } from "@/games/kingdomino/client/controller-page.tsx";

export const Route = createFileRoute( "/kingdomino/$gameId/controller" )( {
	component: ControllerRoute
} );

function ControllerRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<KingdominoControllerPage gameId={ gameId }/>
		</RequireSession>
	);
}

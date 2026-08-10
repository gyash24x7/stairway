import { createFileRoute } from "@tanstack/react-router";

import { KingdominoControllerPage } from "@/games/kingdomino/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";

// No `fullBleed`: a phone wants the navbar (log out, theme, home).
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

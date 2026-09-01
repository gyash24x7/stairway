import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { CoupGamePage } from "@/games/coup/client/game-page.tsx";

export const Route = createFileRoute( "/coup/$gameId/" )( {
	component: GameRoute
} );

function GameRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<CoupGamePage gameId={ gameId }/>
		</RequireSession>
	);
}

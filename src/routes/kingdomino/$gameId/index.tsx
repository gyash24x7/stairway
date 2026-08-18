import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { KingdominoGamePage } from "@/games/kingdomino/client/game-page.tsx";

export const Route = createFileRoute( "/kingdomino/$gameId/" )( {
	component: GameRoute
} );

function GameRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<KingdominoGamePage gameId={ gameId }/>
		</RequireSession>
	);
}

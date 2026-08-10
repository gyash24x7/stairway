import { createFileRoute } from "@tanstack/react-router";

import { KingdominoGamePage } from "@/games/kingdomino/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";

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

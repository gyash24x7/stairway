import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { CallbreakGamePage } from "@/games/callbreak/client/game-page.tsx";

export const Route = createFileRoute( "/callbreak/$gameId/" )( {
	component: GameRoute
} );

function GameRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<CallbreakGamePage gameId={ gameId }/>
		</RequireSession>
	);
}

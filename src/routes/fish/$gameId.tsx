import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { FishGamePage } from "@/games/fish/client/game-page.tsx";

export const Route = createFileRoute( "/fish/$gameId" )( {
	component: GameRoute
} );

function GameRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<FishGamePage gameId={ gameId }/>
		</RequireSession>
	);
}

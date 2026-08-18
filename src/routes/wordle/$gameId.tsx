import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { WordleGamePage } from "@/games/wordle/client/game-page.tsx";

export const Route = createFileRoute( "/wordle/$gameId" )( {
	component: GameRoute
} );

function GameRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<WordleGamePage gameId={ gameId }/>
		</RequireSession>
	);
}

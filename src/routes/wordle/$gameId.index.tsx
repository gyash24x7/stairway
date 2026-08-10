import { createFileRoute } from "@tanstack/react-router";

import { WordleGamePage } from "@/games/wordle/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";

export const Route = createFileRoute( "/wordle/$gameId/" )( {
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

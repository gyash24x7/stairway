import { createFileRoute } from "@tanstack/react-router";

import { CallbreakGamePage } from "@/games/callbreak/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";

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

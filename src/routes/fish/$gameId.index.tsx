import { createFileRoute } from "@tanstack/react-router";

import { FishGamePage } from "@/games/fish/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";

export const Route = createFileRoute( "/fish/$gameId/" )( {
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

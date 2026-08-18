import { createFileRoute } from "@tanstack/react-router";

import { RequireSession } from "@/auth/client/require-session.tsx";
import { SplendorGamePage } from "@/games/splendor/client/game-page.tsx";

export const Route = createFileRoute( "/splendor/$gameId/" )( {
	component: GameRoute
} );

function GameRoute() {
	const { gameId } = Route.useParams();
	return (
		<RequireSession>
			<SplendorGamePage gameId={ gameId }/>
		</RequireSession>
	);
}

import { createFileRoute } from "@tanstack/react-router";

import { SplendorGamePage } from "@/games/splendor/client/index.ts";
import { RequireSession } from "@/shared/ui/components/require-session.tsx";

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

import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { KingdominoHomePage } from "@/games/kingdomino/client/index.ts";

export const Route = createFileRoute( "/kingdomino/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <KingdominoHomePage isLoggedIn={ !!authInfo }/>;
}

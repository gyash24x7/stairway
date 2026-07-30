import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { CallbreakHomePage } from "@/games/callbreak/client/index.ts";

export const Route = createFileRoute( "/callbreak/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <CallbreakHomePage isLoggedIn={ !!authInfo }/>;
}

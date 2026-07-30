import { useAuth } from "@/auth/client/use-auth";
import { CallbreakHomePage } from "@/games/callbreak/client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/callbreak/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <CallbreakHomePage isLoggedIn={ !!authInfo }/>;
}

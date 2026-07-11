import { useAuth } from "@s2h-ui/auth/use-auth";
import { CallbreakHomePage } from "@s2h-ui/callbreak";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/callbreak/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <CallbreakHomePage isLoggedIn={ !!authInfo }/>;
}

import { useAuth } from "@s2h-ui/auth/use-auth";
import { SplendorHomePage } from "@s2h-ui/splendor";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/splendor/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <SplendorHomePage isLoggedIn={ !!authInfo }/>;
}

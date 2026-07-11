import { useAuth } from "@s2h-ui/auth/use-auth";
import { FishHomePage } from "@s2h-ui/fish";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/fish/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <FishHomePage isLoggedIn={ !!authInfo }/>;
}

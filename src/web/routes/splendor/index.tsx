import { useAuth } from "@/auth/client/use-auth";
import { SplendorHomePage } from "@/games/splendor/client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/splendor/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <SplendorHomePage isLoggedIn={ !!authInfo }/>;
}

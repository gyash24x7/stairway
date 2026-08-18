import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { SplendorHomePage } from "@/games/splendor/client/home-page.tsx";

export const Route = createFileRoute( "/splendor/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <SplendorHomePage isLoggedIn={ !!authInfo }/>;
}

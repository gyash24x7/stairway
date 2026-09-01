import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { CoupHomePage } from "@/games/coup/client/home-page.tsx";

export const Route = createFileRoute( "/coup/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <CoupHomePage isLoggedIn={ !!authInfo }/>;
}

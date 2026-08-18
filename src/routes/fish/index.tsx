import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { FishHomePage } from "@/games/fish/client/home-page.tsx";

export const Route = createFileRoute( "/fish/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <FishHomePage isLoggedIn={ !!authInfo }/>;
}

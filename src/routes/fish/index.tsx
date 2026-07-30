import { useAuth } from "@/auth/client/use-auth.tsx";
import { FishHomePage } from "@/games/fish/client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/fish/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <FishHomePage isLoggedIn={ !!authInfo }/>;
}

import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { WordleHomePage } from "@/games/wordle/client/home-page.tsx";

export const Route = createFileRoute( "/wordle/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { authInfo } = useAuth();
	return <WordleHomePage isLoggedIn={ !!authInfo }/>;
}

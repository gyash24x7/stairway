import { GAME_REGISTRY } from "@/games";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/$game/" )( {
	component: GameHomeRoute
} );

function GameHomeRoute() {
	const { game } = Route.useParams();
	const entry = GAME_REGISTRY[ game ];

	if ( !entry ) {
		return <div className={ "text-lg text-center mt-8" }>This game is coming soon.</div>;
	}

	const { Home } = entry;
	return <Home/>;
}

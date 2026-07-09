import { GAME_REGISTRY } from "@/games";
import { useAuth } from "@s2h/ui/hooks/use-auth";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/$game/$gameId" )( {
	component: GameRoute
} );

function GameRoute() {
	const { game, gameId } = Route.useParams();
	const { authInfo, isLoading } = useAuth();
	const entry = GAME_REGISTRY[ game ];

	if ( !entry ) {
		return <div className={ "text-lg text-center mt-8" }>This game is coming soon.</div>;
	}

	if ( isLoading ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	if ( !authInfo ) {
		return <div className={ "text-lg text-center mt-8" }>Please log in to play.</div>;
	}

	const { Game } = entry;
	return <Game gameId={ gameId }/>;
}

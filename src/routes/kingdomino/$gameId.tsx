import { useAuth } from "@/auth/client/use-auth.tsx";
import { KingdominoGamePage } from "@/games/kingdomino/client";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/kingdomino/$gameId" )( {
	component: GameRoute
} );

function GameRoute() {
	const { gameId } = Route.useParams();
	const { authInfo, isLoading } = useAuth();

	if ( isLoading ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	if ( !authInfo ) {
		return <div className={ "text-lg text-center mt-8" }>Please log in to play.</div>;
	}

	return <KingdominoGamePage gameId={ gameId }/>;
}

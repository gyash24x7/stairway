import { useAuth } from "@s2h-ui/auth/use-auth";
import { KingdominoGamePage } from "@s2h-ui/kingdomino";
import { Spinner } from "@s2h/ui/primitives/spinner";
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

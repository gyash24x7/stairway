import { useAuth } from "@/auth/client/use-auth";
import { CallbreakGamePage } from "@/games/callbreak/client";
import { Spinner } from "@/ui/primitives/spinner";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/callbreak/$gameId" )( {
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

	return <CallbreakGamePage gameId={ gameId }/>;
}

import { useAuth } from "@s2h-ui/auth/use-auth";
import { SplendorGamePage } from "@s2h-ui/splendor";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute( "/splendor/$gameId" )( {
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

	return <SplendorGamePage gameId={ gameId }/>;
}

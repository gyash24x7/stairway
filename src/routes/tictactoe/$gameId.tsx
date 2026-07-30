import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { TicTacToeGamePage } from "@/games/tictactoe/client/index.ts";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";

export const Route = createFileRoute( "/tictactoe/$gameId" )( {
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

	return <TicTacToeGamePage gameId={ gameId }/>;
}

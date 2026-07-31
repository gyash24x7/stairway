import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { getStateFn } from "@/games/tictactoe/client/client.ts";
import { TicTacToeProvider } from "@/games/tictactoe/client/context.tsx";
import { GameView } from "@/games/tictactoe/client/game-view.tsx";
import { useGameSync } from "@/sync.ts";

export function TicTacToeGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const queryKey = [ "tic-tac-toe", "getState", gameId ];
	const { data, isLoading } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, authInfo!.id, signal )
	} );

	useGameSync( { gameName: "tic-tac-toe", gameId, playerId: authInfo!.id, queryKey } );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<TicTacToeProvider data={ data } gameId={ gameId }>
			<GameView/>
		</TicTacToeProvider>
	);
}

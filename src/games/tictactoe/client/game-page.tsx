import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { useGameSync } from "@/client.ts";
import { tictactoeApi } from "@/games/tictactoe/client/client.ts";
import { TicTacToeProvider } from "@/games/tictactoe/client/context.tsx";
import { GameView } from "@/games/tictactoe/client/game-view.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { GameId } from "@/swish/shared/schema.ts";

export function TicTacToeGamePage( props: { gameId: string } ) {
	const gameId = GameId.make( props.gameId );
	const { authInfo } = useAuth();

	const queryKey = [ "tictactoe", "getState", gameId ];
	const { data, isLoading, isError, error, refetch } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => tictactoeApi.getView( gameId, signal )
	} );

	useGameSync( { gameName: "tictactoe", gameId, playerId: authInfo!.id, queryKey } );

	if ( isError ) {
		return (
			<ErrorState
				title={ "Couldn't load this game" }
				error={ error }
				onRetry={ () => void refetch() }
				action={ { label: "BACK TO LOBBY", to: "/tictactoe" } }
			/>
		);
	}

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<TicTacToeProvider data={ data } gameId={ gameId }>
			<GameView/>
		</TicTacToeProvider>
	);
}

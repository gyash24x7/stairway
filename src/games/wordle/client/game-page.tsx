import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { getWordleStateFn } from "@/games/wordle/client/client.ts";
import { WordleProvider } from "@/games/wordle/client/context.tsx";
import { GameView } from "@/games/wordle/client/game-view.tsx";
import { useGameSync } from "@/sync.ts";

export function WordleGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const queryKey = [ "wordle", "getState", gameId ];
	const { data, isLoading, isError, error, refetch } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getWordleStateFn( gameId, signal )
	} );

	useGameSync( { gameName: "wordle", gameId, playerId: authInfo!.id, queryKey } );

	if ( isError ) {
		return (
			<ErrorState
				title={ "Couldn't load this game" }
				error={ error }
				onRetry={ () => void refetch() }
				action={ { label: "BACK TO LOBBY", to: "/wordle" } }
			/>
		);
	}

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<WordleProvider data={ data } gameId={ gameId }>
			<GameView/>
		</WordleProvider>
	);
}

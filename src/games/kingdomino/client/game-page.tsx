import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { useGameSync } from "@/client.ts";
import { kingdominoApi } from "@/games/kingdomino/client/client.ts";
import { KingdominoProvider } from "@/games/kingdomino/client/context.tsx";
import { GameView } from "@/games/kingdomino/client/game-view.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { GameId } from "@/swish/shared/schema.ts";

export function KingdominoGamePage( props: { gameId: string } ) {
	const gameId = GameId.make( props.gameId );
	const { authInfo } = useAuth();

	const queryKey = [ "kingdomino", "getState", gameId ];
	const { data, isLoading, isError, error, refetch } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => kingdominoApi.getView( gameId, signal )
	} );

	useGameSync( { gameName: "kingdomino", gameId, playerId: authInfo!.id, queryKey } );

	if ( isError ) {
		return (
			<ErrorState
				title={ "Couldn't load this game" }
				error={ error }
				onRetry={ () => void refetch() }
				action={ { label: "BACK TO LOBBY", to: "/kingdomino" } }
			/>
		);
	}

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<KingdominoProvider data={ data } gameId={ gameId }>
			<GameView/>
		</KingdominoProvider>
	);
}

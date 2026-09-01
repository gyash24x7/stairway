import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { useGameSync } from "@/client.ts";
import { coupApi } from "@/games/coup/client/client.ts";
import { CoupProvider } from "@/games/coup/client/context.tsx";
import { GameView } from "@/games/coup/client/game-view.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { GameId } from "@/swish/shared/schema.ts";

export function CoupGamePage( props: { gameId: string } ) {
	const gameId = GameId.make( props.gameId );
	const { authInfo } = useAuth();

	const queryKey = [ "coup", "getState", gameId ];
	const { data, isLoading, isError, error, refetch } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: () => coupApi.getView( gameId )
	} );

	useGameSync( { gameName: "coup", gameId, playerId: authInfo!.id, queryKey } );

	if ( isError ) {
		return (
			<ErrorState
				title={ "Couldn't load this game" }
				error={ error }
				onRetry={ () => void refetch() }
				action={ { label: "BACK TO LOBBY", to: "/coup" } }
			/>
		);
	}

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<CoupProvider data={ data } gameId={ gameId }>
			<GameView/>
		</CoupProvider>
	);
}

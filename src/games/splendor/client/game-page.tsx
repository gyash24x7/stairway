import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { getStateFn } from "@/games/splendor/client/client.ts";
import { SplendorProvider } from "@/games/splendor/client/context.tsx";
import { GameView } from "@/games/splendor/client/game-view.tsx";
import { useGameSync } from "@/sync.ts";

export function SplendorGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const queryKey = [ "splendor", "getState", gameId ];
	const { data, isLoading, isError, error, refetch } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, signal )
	} );

	useGameSync( { gameName: "splendor", gameId, playerId: authInfo!.id, queryKey } );

	if ( isError ) {
		return (
			<ErrorState
				title={ "Couldn't load this game" }
				error={ error }
				onRetry={ () => void refetch() }
				action={ { label: "BACK TO LOBBY", to: "/splendor" } }
			/>
		);
	}

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<SplendorProvider data={ data }>
			<GameView/>
		</SplendorProvider>
	);
}

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { getStateFn } from "@/games/callbreak/client/client.ts";
import { CallbreakProvider } from "@/games/callbreak/client/context.tsx";
import { GameView } from "@/games/callbreak/client/game-view.tsx";
import { useGameSync } from "@/sync.ts";

export function CallbreakGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const queryKey = [ "callbreak", "getState", gameId ];
	const { data, isLoading } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, authInfo!.id, signal )
	} );

	useGameSync( { gameName: "callbreak", gameId, playerId: authInfo!.id, queryKey } );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<CallbreakProvider data={ data } gameId={ gameId }>
			<GameView/>
		</CallbreakProvider>
	);
}

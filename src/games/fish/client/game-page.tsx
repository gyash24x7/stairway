import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { getStateFn } from "@/games/fish/client/client.ts";
import { FishProvider } from "@/games/fish/client/context.tsx";
import { GameView } from "@/games/fish/client/game-view.tsx";
import { useGameSync } from "@/sync.ts";

export function FishGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const queryKey = [ "fish", "getState", gameId ];
	const { data, isLoading } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, authInfo!.id, signal )
	} );

	useGameSync( { gameName: "fish", gameId, playerId: authInfo!.id, queryKey } );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<FishProvider data={ data }>
			<GameView/>
		</FishProvider>
	);
}

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { toPlayerInfo } from "@/client.ts";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { getKingdominoStateFn } from "@/games/kingdomino/client/client.ts";
import { KingdominoProvider } from "@/games/kingdomino/client/context.tsx";
import { GameView } from "@/games/kingdomino/client/game-view.tsx";
import { useGameSync } from "@/sync.ts";

export function KingdominoGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const queryKey = [ "kingdomino", "getState", gameId ];
	const { data, isLoading } = useQuery( {
		queryKey,
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getKingdominoStateFn( gameId, toPlayerInfo( authInfo! ), signal )
	} );

	useGameSync( { gameName: "kingdomino", gameId, playerId: authInfo!.id, queryKey } );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<KingdominoProvider data={ data }>
			<GameView/>
		</KingdominoProvider>
	);
}

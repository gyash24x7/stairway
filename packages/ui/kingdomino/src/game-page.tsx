import { useAuth } from "@s2h-ui/auth/use-auth";
import { toPlayerInfo } from "@s2h/contract/client";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { useQuery } from "@tanstack/react-query";
import { getKingdominoStateFn } from "./client";
import { KingdominoProvider } from "./context";
import { GameView } from "./game-view";

export function KingdominoGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const { data, isLoading } = useQuery( {
		queryKey: [ "kingdomino", "getState", gameId ],
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getKingdominoStateFn( gameId, toPlayerInfo( authInfo! ), signal )
	} );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<KingdominoProvider data={ data }>
			<GameView/>
		</KingdominoProvider>
	);
}

import { useAuth } from "@/auth/client/use-auth";
import { Spinner } from "@/ui/primitives/spinner";
import { useQuery } from "@tanstack/react-query";
import { getStateFn, snapshotToData, toPlayerInfo } from "./client";
import { TicTacToeProvider } from "./context";
import { GameView } from "./game-view";

export function TicTacToeGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const { data, isLoading } = useQuery( {
		queryKey: [ "tic-tac-toe", "getState", gameId ],
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, toPlayerInfo( authInfo! ), signal )
	} );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<TicTacToeProvider data={ snapshotToData( data ) } gameId={ gameId }>
			<GameView/>
		</TicTacToeProvider>
	);
}

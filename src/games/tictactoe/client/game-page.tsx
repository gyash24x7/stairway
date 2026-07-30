import { useAuth } from "@/auth/client/use-auth";
import { Spinner } from "@/shared/ui/primitives/spinner";
import { useQuery } from "@tanstack/react-query";
import { getStateFn } from "./client";
import { TicTacToeProvider } from "./context";
import { GameView } from "./game-view";

export function TicTacToeGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const { data, isLoading } = useQuery( {
		queryKey: [ "tic-tac-toe", "getState", gameId ],
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, authInfo!.id, signal )
	} );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<TicTacToeProvider data={ data } gameId={ gameId }>
			<GameView/>
		</TicTacToeProvider>
	);
}

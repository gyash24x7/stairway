import { useAuth } from "@s2h-ui/auth/use-auth";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { useQuery } from "@tanstack/react-query";
import { getStateFn } from "./client";
import { CallbreakProvider } from "./context";
import { GameView } from "./game-view";

export function CallbreakGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const { data, isLoading } = useQuery( {
		queryKey: [ "callbreak", "getState", gameId ],
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, authInfo!.id, signal )
	} );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<CallbreakProvider data={ data } gameId={ gameId }>
			<GameView/>
		</CallbreakProvider>
	);
}

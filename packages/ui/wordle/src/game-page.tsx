import { useAuth } from "@s2h-ui/auth/use-auth";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { useQuery } from "@tanstack/react-query";
import { getWordleStateFn, snapshotToWordleData, toPlayerInfo } from "./client";
import { WordleProvider } from "./context";
import { GameView } from "./game-view";

export function WordleGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const { data, isLoading } = useQuery( {
		queryKey: [ "wordle", "getState", gameId ],
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getWordleStateFn( gameId, toPlayerInfo( authInfo! ), signal )
	} );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<WordleProvider data={ snapshotToWordleData( data ) } gameId={ gameId }>
			<GameView/>
		</WordleProvider>
	);
}

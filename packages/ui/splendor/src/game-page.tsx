import { useAuth } from "@s2h-ui/auth/use-auth";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { useQuery } from "@tanstack/react-query";
import { getStateFn, toPlayerInfo } from "./client";
import { SplendorProvider } from "./context";
import { GameView } from "./game-view";

export function SplendorGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const { data, isLoading } = useQuery( {
		queryKey: [ "splendor", "getState", gameId ],
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, toPlayerInfo( authInfo! ), signal )
	} );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<SplendorProvider snapshot={ data } gameId={ gameId }>
			<GameView/>
		</SplendorProvider>
	);
}

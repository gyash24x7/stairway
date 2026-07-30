import { useAuth } from "@/auth/client/use-auth";
import { Spinner } from "@/ui/primitives/spinner";
import { useQuery } from "@tanstack/react-query";
import { getStateFn } from "./client";
import { FishProvider } from "./context";
import { GameView } from "./game-view";

export function FishGamePage( { gameId }: { gameId: string } ) {
	const { authInfo } = useAuth();

	const { data, isLoading } = useQuery( {
		queryKey: [ "fish", "getState", gameId ],
		enabled: !!authInfo,
		queryFn: ( { signal } ) => getStateFn( gameId, authInfo!.id, signal )
	} );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<FishProvider data={ data }>
			<GameView/>
		</FishProvider>
	);
}

import { orpc } from "@s2h/client/query";
import { CallbreakProvider } from "@/callbreak/components/context";
import { GameView } from "@/callbreak/components/game-view";
import { Spinner } from "@/shared/primitives/spinner";
import { useQuery } from "@tanstack/react-query";

export function CallbreakGamePage( { gameId }: { gameId: string } ) {
	const { data, isLoading } = useQuery( orpc.callbreak.getGame.queryOptions( { input: { gameId } } ) );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<CallbreakProvider data={ data }>
			<GameView/>
		</CallbreakProvider>
	);
}

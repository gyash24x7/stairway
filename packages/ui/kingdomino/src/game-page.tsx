import { orpc } from "@s2h/client/query";
import { KingdominoProvider } from "./context";
import { GameView } from "./game-view";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { useQuery } from "@tanstack/react-query";

export function KingdominoGamePage( { gameId }: { gameId: string } ) {
	const { data, isLoading } = useQuery(
		orpc.kingdomino.getGame.queryOptions( { input: { gameId } } )
	);

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<KingdominoProvider data={ data }>
			<GameView/>
		</KingdominoProvider>
	);
}

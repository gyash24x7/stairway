import { orpc } from "@/api/query";
import { KingdominoProvider } from "@/kingdomino/components/context";
import { GameView } from "@/kingdomino/components/game-view";
import { Spinner } from "@/shared/primitives/spinner";
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

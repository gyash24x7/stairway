import { orpc } from "@/api/query";
import { Spinner } from "@/shared/primitives/spinner";
import { WordleProvider } from "@/wordle/components/context";
import { GameView } from "@/wordle/components/game-view";
import { useQuery } from "@tanstack/react-query";

export function WordleGamePage( { gameId }: { gameId: string } ) {
	const { data, isLoading } = useQuery( orpc.wordle.getGame.queryOptions( { input: { gameId } } ) );

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<WordleProvider data={ data }>
			<GameView/>
		</WordleProvider>
	);
}

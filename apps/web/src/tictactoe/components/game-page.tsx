import { orpc } from "@s2h/client/query";
import { Spinner } from "@/shared/primitives/spinner";
import { TicTacToeProvider } from "@/tictactoe/components/context";
import { GameView } from "@/tictactoe/components/game-view";
import { useQuery } from "@tanstack/react-query";

export function TicTacToeGamePage( { gameId }: { gameId: string } ) {
	const { data, isLoading } = useQuery(
		orpc.tictactoe.getGame.queryOptions( { input: { gameId } } )
	);

	if ( isLoading || !data ) {
		return <div className={ "mt-8 flex justify-center" }><Spinner/></div>;
	}

	return (
		<TicTacToeProvider data={ data }>
			<GameView/>
		</TicTacToeProvider>
	);
}

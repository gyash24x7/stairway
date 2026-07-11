import { orpc } from "@s2h/client/query";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { TicTacToeProvider } from "./context";
import { GameView } from "./game-view";
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

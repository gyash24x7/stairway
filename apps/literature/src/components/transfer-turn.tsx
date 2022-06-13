import { Button } from "@s2h/ui";

import { useGame } from "../utils/game-context";
import { trpc } from "../utils/trpc";

export function TransferTurn() {
	const { id: gameId } = useGame();
	const { mutateAsync, isLoading } = trpc.useMutation( "transfer-turn" );

	const transferTurn = () => mutateAsync( { gameId } );

	return (
		<Button
			buttonText = { "Transfer Turn" }
			appearance = { "success" }
			fullWidth
			isLoading = { isLoading }
			onClick = { transferTurn }
		/>
	);
}
import { Button, Flex } from "@s2h/ui";
import { trpc, useGame } from "../utils";

export function StartGame() {
	const { id: gameId } = useGame();

	const { mutateAsync, isLoading } = trpc.startGame.useMutation( {
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const startGame = () => mutateAsync( { gameId } );

	return (
		<Flex justify={ "center" } className={ "mt-4" }>
			<Button
				fullWidth
				buttonText={ "Start Game" }
				appearance={ "primary" }
				isLoading={ isLoading }
				onClick={ startGame }
			/>
		</Flex>
	);
}
import { Button } from "@mantine/core";
import { useCurrentGame } from "../utils";
import { useStartGameMutation } from "@literature/client";

export function StartGame() {
	const { id } = useCurrentGame();

	const { mutateAsync, isLoading } = useStartGameMutation( id, {
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const startGame = () => mutateAsync();

	return <Button fullWidth color={ "primary" } loading={ isLoading } onClick={ startGame }>Start Game</Button>;
}
import { Button } from "@mantine/core";
import { useCurrentGame } from "../utils";
import { useStartGameMutation } from "@literature/client";

export function StartGame() {
	const { id } = useCurrentGame();

	const { mutateAsync, isPending } = useStartGameMutation( id, {
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	const startGame = () => mutateAsync();

	return <Button fullWidth color={ "primary" } loading={ isPending } onClick={ startGame }>Start Game</Button>;
}
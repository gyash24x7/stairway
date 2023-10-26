import { Button } from "@mantine/core";
import { useAction } from "@s2h/ui";
import { startGame, useGameStore } from "../utils";

export function StartGame() {
	const gameId = useGameStore( ( state ) => state.gameData!.id );
	const { execute, isLoading } = useAction( startGame );

	const handleSubmit = () => execute( { gameId } )
		.catch( ( error ) => alert( error.message ) );

	return <Button fullWidth color={ "primary" } loading={ isLoading } onClick={ handleSubmit }>Start Game</Button>;
}
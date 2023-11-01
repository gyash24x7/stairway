import { Button } from "@mantine/core";
import { useCallback } from "react";
import { useGameId, useStartGameAction } from "../store";

export function StartGame() {
	const gameId = useGameId();
	const { execute, isLoading } = useStartGameAction();

	const handleSubmit = useCallback(
		() => execute( { gameId } ).catch( ( error ) => alert( error.message ) ),
		[ gameId ]
	);

	return <Button color={ "brand" } loading={ isLoading } onClick={ handleSubmit } fw={ 700 }>START GAME</Button>;
}
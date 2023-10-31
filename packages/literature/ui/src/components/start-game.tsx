import { Button } from "@mantine/core";
import { useGameData, useStartGameAction } from "../utils";
import { useCallback } from "react";

export function StartGame() {
	const { id: gameId } = useGameData()!;
	const { execute, isLoading } = useStartGameAction();

	const handleSubmit = useCallback(
		() => execute( { gameId } ).catch( ( error ) => alert( error.message ) ),
		[ gameId ]
	);

	return <Button color={ "brand" } loading={ isLoading } onClick={ handleSubmit } fw={ 700 }>START GAME</Button>;
}
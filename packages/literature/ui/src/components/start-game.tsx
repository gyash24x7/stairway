import { Button } from "@mantine/core";
import { useCallback } from "react";
import { useGameId, useStartGameAction } from "../store";

export function StartGame() {
	const gameId = useGameId();
	const { mutateAsync, isPending } = useStartGameAction();

	const handleSubmit = useCallback(
		() => mutateAsync( { gameId } ).catch( ( error ) => alert( error.message ) ),
		[ gameId ]
	);

	return <Button color={ "brand" } loading={ isPending } onClick={ handleSubmit } fw={ 700 }>START GAME</Button>;
}
import { useAddBotsAction, useGameId } from "@literature/ui";
import { Button } from "@mantine/core";
import { useCallback } from "react";

export function AddBots() {
	const gameId = useGameId();
	const { execute, isLoading } = useAddBotsAction();

	const handleSubmit = useCallback(
		() => execute( { gameId } ),
		[ gameId ]
	);

	return <Button color={ "info" } onClick={ handleSubmit } fw={ 700 } loading={ isLoading }>ADD BOTS</Button>;
}
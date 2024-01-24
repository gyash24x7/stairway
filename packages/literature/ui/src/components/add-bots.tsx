import { Button } from "@mantine/core";
import { useCallback } from "react";
import { useAddBotsAction, useGameId } from "../store";

export function AddBots() {
	const gameId = useGameId();
	const { mutateAsync, isPending } = useAddBotsAction();

	const handleSubmit = useCallback(
		() => mutateAsync( { gameId } ),
		[ gameId ]
	);

	return <Button color={ "info" } onClick={ handleSubmit } fw={ 700 } loading={ isPending }>ADD BOTS</Button>;
}
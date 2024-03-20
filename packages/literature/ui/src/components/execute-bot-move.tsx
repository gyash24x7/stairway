import { Button } from "@mantine/core";
import { useCallback } from "react";
import { useExecuteBotMoveMutation, useGameId } from "../store";

export function ExecuteBotMove() {
	const { isPending, mutateAsync } = useExecuteBotMoveMutation();
	const gameId = useGameId();

	const handleSubmit = useCallback(
		() => mutateAsync( { gameId } ).catch( ( error: Error ) => alert( error.message ) ),
		[]
	);

	return (
		<Button color={ "brand" } onClick={ handleSubmit } loading={ isPending } fw={ 700 }>
			Execute Bot Move
		</Button>
	);
}
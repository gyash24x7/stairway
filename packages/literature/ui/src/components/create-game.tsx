import { useCreateGameAction } from "@literature/store";
import { Button } from "@mantine/core";
import { useCallback } from "react";

export function CreateGame() {
	const { isLoading, execute } = useCreateGameAction();

	const handleSubmit = useCallback(
		() => execute( { playerCount: 6 } )
			.catch( ( error: Error ) => alert( error.message ) ),
		[]
	);

	return (
		<Button color={ "brand" } onClick={ handleSubmit } loading={ isLoading } fw={ 700 }>
			NEW GAME
		</Button>
	);
}
import { Button } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useCreateGameAction } from "../store";

export function CreateGame() {
	const navigate = useNavigate();
	const { isPending, mutateAsync } = useCreateGameAction();

	const handleSubmit = useCallback(
		() => mutateAsync( { wordCount: 2, wordLength: 5 } )
			.then( ( data ) => navigate( { to: "/wordle/$gameId", params: { gameId: data.id } } ) )
			.catch( ( error: Error ) => alert( error.message ) ),
		[]
	);

	return (
		<Button color={ "brand" } onClick={ handleSubmit } loading={ isPending } fw={ 700 }>
			NEW GAME
		</Button>
	);
}
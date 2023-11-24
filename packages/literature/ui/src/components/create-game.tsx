import { useCreateGameAction } from "@literature/store";
import { Button } from "@mantine/core";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export function CreateGame() {
	const navigate = useNavigate();
	const { isLoading, execute } = useCreateGameAction();

	const handleSubmit = useCallback(
		() => execute( { playerCount: 6 } )
			.then( ( { id } ) => navigate( "/literature/" + id ) )
			.catch( ( error: Error ) => alert( error.message ) ),
		[]
	);

	return (
		<Button color={ "brand" } onClick={ handleSubmit } loading={ isLoading } fw={ 700 }>
			NEW GAME
		</Button>
	);
}
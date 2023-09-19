import { Button, Stack, TextInput } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useJoinGameMutation } from "@literature/client";
import { ChangeEvent, useState } from "react";

export function JoinGame() {
	const navigate = useNavigate();
	const [ code, setCode ] = useState( "" );

	const handleCodeChange = ( e: ChangeEvent<HTMLInputElement> ) => setCode( e.currentTarget.value.toUpperCase() );

	const joinGame = () => joinGameMutation.mutateAsync( { code } );

	const joinGameMutation = useJoinGameMutation( {
		onSuccess: ( id ) => navigate( "/literature/" + id ),
		onError( error: Error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	return (
		<Stack>
			<TextInput
				name={ "code" }
				value={ code }
				onChange={ handleCodeChange }
				placeholder={ "Enter the Game Code" }
			/>
			<Button color={ "primary" } fullWidth onClick={ joinGame } loading={ joinGameMutation.isLoading }>
				Join Game
			</Button>
		</Stack>
	);
}
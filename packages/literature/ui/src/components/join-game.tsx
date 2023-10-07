import { Button, Modal, Stack, TextInput } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useJoinGameMutation } from "@literature/client";
import { ChangeEvent, Fragment, useState } from "react";
import { modals } from "@mantine/modals";
import { useDisclosure } from "@mantine/hooks";

export function JoinGame() {
	const navigate = useNavigate();
	const [ code, setCode ] = useState( "" );
	const [ opened, { open, close } ] = useDisclosure( false );

	const handleCodeChange = ( e: ChangeEvent<HTMLInputElement> ) => setCode( e.currentTarget.value.toUpperCase() );

	const joinGame = () => joinGameMutation.mutateAsync( { code } );

	const joinGameMutation = useJoinGameMutation( {
		onSuccess: ( { id } ) => {
			modals.closeAll();
			navigate( "/literature/" + id );
		},
		onError( error: Error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	return (
		<Fragment>
			<Button color={ "warning" } onClick={ open }>Join Game</Button>
			<Modal opened={ opened } onClose={ close } title={ "Join Game" }>
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
			</Modal>
		</Fragment>
	);
}
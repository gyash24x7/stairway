import { Button, Modal, Stack, TextInput } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { ChangeEvent, Fragment, useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { useAction } from "@s2h/ui";
import { joinGame } from "../utils";

export function JoinGame() {
	const navigate = useNavigate();
	const [ code, setCode ] = useState( "" );
	const [ opened, { open, close } ] = useDisclosure( false );

	const { execute, isLoading } = useAction( joinGame );

	const handleSubmit = () => execute( { code } )
		.then( ( { id } ) => navigate( `/literature/${ id }` ) )
		.catch( ( error: Error ) => alert( error.message ) );

	const handleCodeChange = ( e: ChangeEvent<HTMLInputElement> ) => setCode( e.currentTarget.value.toUpperCase() );

	return (
		<Fragment>
			<Button color={ "warning" } onClick={ open }>Join Game</Button>
			<Modal opened={ opened } onClose={ close } title={ "Join Game" } centered>
				<Stack>
					<TextInput
						name={ "code" }
						value={ code }
						onChange={ handleCodeChange }
						placeholder={ "Enter the Game Code" }
					/>
					<Button color={ "primary" } fullWidth onClick={ handleSubmit } loading={ isLoading }>
						Join Game
					</Button>
				</Stack>
			</Modal>
		</Fragment>
	);
}
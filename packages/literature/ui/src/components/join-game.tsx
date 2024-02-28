import { Button, Modal, Stack, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useNavigate } from "@tanstack/react-router";
import { ChangeEvent, Fragment, useCallback, useState } from "react";
import { useJoinGameAction } from "../store";

export function JoinGame() {
	const navigate = useNavigate();
	const [ code, setCode ] = useState( "" );
	const [ opened, { open, close } ] = useDisclosure( false );

	const { mutateAsync, isPending } = useJoinGameAction();

	const handleSubmit = useCallback(
		() => mutateAsync( { code } )
			.then( ( data ) => navigate( { to: "/literature/$gameId", params: { gameId: data.id } } ) )
			.catch( ( error: Error ) => alert( error.message ) ),
		[ code ]
	);

	const handleCodeChange = useCallback(
		( e: ChangeEvent<HTMLInputElement> ) => setCode( e.currentTarget.value.toUpperCase() ),
		[]
	);

	return (
		<Fragment>
			<Button color={ "warning" } onClick={ open } fw={ 700 }>JOIN GAME</Button>
			<Modal opened={ opened } onClose={ close } title={ <Title order={ 3 }>Join Game</Title> } centered>
				<Stack>
					<TextInput
						name={ "code" }
						value={ code }
						onChange={ handleCodeChange }
						placeholder={ "Enter the Game Code" }
					/>
					<Button color={ "brand" } fullWidth onClick={ handleSubmit } loading={ isPending } fw={ 700 }>
						JOIN GAME
					</Button>
				</Stack>
			</Modal>
		</Fragment>
	);
}
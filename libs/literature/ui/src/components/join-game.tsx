import { Button, Modal, TextInput } from "@s2h/ui";
import { Fragment, useState } from "react";
import { useNavigate } from "@tanstack/router";
import { trpc } from "../utils";

export const JoinGame = () => {
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ code, setCode ] = useState( "" );
	const navigate = useNavigate();

	const { mutateAsync, isLoading } = trpc.joinGame.useMutation( {
		async onSuccess( data ) {
			const { id } = data;
			await navigate( { to: `/$gameId`, params: { gameId: id } } );
		},
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	return (
		<Fragment>
			<Button
				buttonText={ "Join Game" }
				appearance={ "warning" }
				fullWidth
				onClick={ () => setIsModalOpen( true ) }
			/>
			<Modal
				isOpen={ isModalOpen }
				onClose={ () => setIsModalOpen( false ) }
				title={ "Join Game" }
			>
				<TextInput
					name={ "gameCode" }
					value={ code }
					onChange={ ( v ) => setCode( v.toUpperCase() ) }
					placeholder={ "Enter the 7-digit Game Code" }
				/>
				<div className={ "mt-6" }>
					<Button
						buttonText={ "Submit" }
						appearance={ "primary" }
						fullWidth
						isLoading={ isLoading }
						onClick={ () => mutateAsync( { code } ) }
					/>
				</div>
			</Modal>
		</Fragment>
	);
};
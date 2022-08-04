import React, { Fragment, useState } from "react";
import { Button, Modal, TextInput } from "@s2h/ui";
import { trpc } from "../utils/trpc";
import { useNavigate } from "react-router-dom";

export const JoinGame = function () {
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ code, setCode ] = useState( "" );
	const navigate = useNavigate();

	const { mutateAsync, isLoading } = trpc.useMutation( "join-game", {
		async onSuccess( data ) {
			const { id } = data;
			navigate( `/play/${ id }` );
		},
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	return (
		<Fragment>
			<Button
				buttonText = { "Join Game" }
				appearance = { "warning" }
				fullWidth
				onClick = { () => setIsModalOpen( true ) }
			/>
			<Modal
				isOpen = { isModalOpen }
				onClose = { () => setIsModalOpen( false ) }
				title = { "Join Game" }
			>
				<TextInput
					name = { "gameCode" }
					value = { code }
					onChange = { ( v ) => setCode( v.toUpperCase() ) }
					placeholder = { "Enter the 7-digit Game Code" }
				/>
				<div className = { "mt-6" }>
					<Button
						buttonText = { "Submit" }
						appearance = { "primary" }
						fullWidth
						isLoading = { isLoading }
						onClick = { () => mutateAsync( { code } ) }
					/>
				</div>
			</Modal>
		</Fragment>
	);
};
import { trpc } from "../utils/trpc";
import { useNavigate } from "react-router-dom";
import { Button } from "@s2h/ui";
import React from "react";

export const CreateGame = function () {
	const navigate = useNavigate();

	const { mutateAsync, isLoading } = trpc.useMutation( "create-game", {
		async onSuccess( { id } ) {
			navigate( `/play/${ id }` );
		},
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	return (
		<Button
			buttonText = { "Create Game" }
			appearance = { "primary" }
			fullWidth
			isLoading = { isLoading }
			onClick = { () => mutateAsync( { playerCount: 2 } ) }
		/>
	);
};
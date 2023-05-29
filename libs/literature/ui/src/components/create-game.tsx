import { Button } from "@s2h/ui";
import { useNavigate } from "@tanstack/router";
import { trpc } from "../utils";

export const CreateGame = () => {
	const navigate = useNavigate();

	const { mutateAsync, isLoading } = trpc.createGame.useMutation( {
		async onSuccess( { id } ) {
			await navigate( { to: "$gameId", params: { gameId: id } } );
		},
		onError( error ) {
			console.log( error );
			alert( error.message );
		}
	} );

	return (
		<Button
			buttonText={ "Create Game" }
			appearance={ "primary" }
			fullWidth
			isLoading={ isLoading }
			onClick={ () => mutateAsync( { playerCount: 2 } ) }
		/>
	);
};
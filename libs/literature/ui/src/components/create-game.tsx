import { Button } from "@s2h/ui";
import { useNavigate } from "react-router-dom";
import { trpc } from "../utils";

export function CreateGame() {
	const navigate = useNavigate();

	const { mutateAsync, isLoading } = trpc.createGame.useMutation( {
		onSuccess: ( { id } ) => navigate( id ),
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
}
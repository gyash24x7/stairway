import { Button, ButtonSpinner, ButtonText } from "@gluestack-ui/themed";
import { router } from "expo-router";
import { useCreateGameMutation } from "../store";

export const CreateGame = () => {
	const { mutateAsync, isPending } = useCreateGameMutation();
	const handleSubmit = async () => mutateAsync( { playerCount: 6 } )
		.then( ( data ) => {
			router.replace( `/literature/${ data.id }` );
		} )
		.catch( e => {
			console.log( e );
		} );

	return (
		<Button flex={ 1 } onPress={ handleSubmit }>
			{ isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>CREATE GAME</ButtonText> }
		</Button>
	);
};
import { Button, ButtonSpinner, ButtonText } from "@gluestack-ui/themed";
import { router } from "expo-router";
import { useCreateGameAction } from "../store";

export function CreateGame() {
	const { isPending, mutateAsync } = useCreateGameAction();

	const handleSubmit = () => mutateAsync( { wordCount: 4, wordLength: 5 } )
		.then( ( data ) => router.replace( `/wordle/${ data.id }` ) )
		.catch( ( error: Error ) => alert( error.message ) );

	return (
		<Button onPress={ handleSubmit }>
			{ isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>CREATE GAME</ButtonText> }
		</Button>
	);
}
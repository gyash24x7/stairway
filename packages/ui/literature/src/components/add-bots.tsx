import { Button, ButtonSpinner, ButtonText } from "@gluestack-ui/themed";
import { useAddBotsMutation, useGameId } from "../store";

export const AddBots = () => {
	const gameId = useGameId();
	const { mutateAsync, isPending } = useAddBotsMutation();
	const handleSubmit = async () => mutateAsync( { gameId } ).catch( e => {
		console.log( e );
	} );

	return (
		<Button onPress={ handleSubmit }>
			{ isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>ADD BOTS</ButtonText> }
		</Button>
	);
};
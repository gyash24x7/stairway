import { Button, ButtonSpinner, ButtonText } from "@gluestack-ui/themed";
import { useGameId, useStartGameMutation } from "../store";

export const StartGame = () => {
	const gameId = useGameId();
	const { mutateAsync, isPending } = useStartGameMutation();
	const handleSubmit = async () => mutateAsync( { gameId } ).catch( e => {
		console.log( e );
	} );

	return (
		<Button onPress={ handleSubmit }>
			{ isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>START GAME</ButtonText> }
		</Button>
	);
};
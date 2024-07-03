import { Button, ButtonSpinner, ButtonText } from "@gluestack-ui/themed";
import { useExecuteBotMoveMutation, useGameId } from "../store";

export const ExecuteBotMove = () => {
	const gameId = useGameId();
	const { mutateAsync, isPending } = useExecuteBotMoveMutation();
	const handleSubmit = async () => mutateAsync( { gameId } ).catch( e => {
		console.log( e );
	} );

	return (
		<Button flex={ 1 } onPress={ handleSubmit }>
			{ isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText size={ "sm" }>EXECUTE BOT MOVE</ButtonText> }
		</Button>
	);
};
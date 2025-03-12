import { Button, Spinner } from "@base/components";
import { wordle } from "@stairway/clients/wordle";

export function CreateGame( props: { navigate: ( gameId: string ) => Promise<void> } ) {
	const { mutate, isPending } = wordle.useCreateGameMutation(
		( game ) => props.navigate( game.id )
	);
	return (
		<Button onClick={ () => mutate( {} ) } disabled={ isPending }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}

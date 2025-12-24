import { Button } from "@s2h-ui/primitives/button";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useAddBotsMutation } from "@s2h/client/callbreak";
import { useStore } from "@tanstack/react-store";
import { store } from "./store.tsx";

export function AddBots() {
	const gameId = useStore( store, state => state.id );
	const { mutateAsync, isPending } = useAddBotsMutation( {
		onError: ( err ) => alert( err.message )
	} );

	const handleClick = () => mutateAsync( { gameId } );

	return (
		<Button onClick={ handleClick } disabled={ isPending } className={ "w-full max-w-lg" }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}
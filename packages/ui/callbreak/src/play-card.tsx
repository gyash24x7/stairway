import { Button } from "@s2h-ui/primitives/button";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { usePlayCardMutation } from "@s2h/client/callbreak";
import { useStore } from "@tanstack/react-store";
import { handleCardSelect, store } from "./store.tsx";

export function PlayCard() {
	const gameId = useStore( store, state => state.id );
	const dealId = useStore( store, state => state.currentDeal!.id );
	const roundId = useStore( store, state => state.currentRound!.id );
	const selectedCard = useStore( store, state => state.play.selectedCard );

	const { mutateAsync, isPending } = usePlayCardMutation( {
		onSuccess: () => {
			handleCardSelect( undefined );
		},
		onError: ( error ) => alert( error.message )
	} );

	const handleClick = () => mutateAsync( { gameId, dealId, roundId, cardId: selectedCard! } );

	return (
		<Button
			onClick={ handleClick }
			disabled={ isPending || !selectedCard }
			className={ "w-full max-w-lg" }
		>
			{ isPending ? <Spinner/> : "PLAY CARD" }
		</Button>
	);
}

import { Button } from "@s2h-ui/primitives/button";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useReserveCardMutation } from "@s2h/client/splendor";
import { useStore } from "@tanstack/react-store";
import { store } from "./store.tsx";

export function ReserveCard() {
	const gameId = useStore( store, state => state.id );
	const withGold = useStore( store, state => state.tokens.gold > 0 );
	const selectedCardId = useStore( store, state => state.local.selectedCard );

	const { mutateAsync, isPending } = useReserveCardMutation( {} );

	const handleClick = () => mutateAsync( { gameId, withGold, cardId: selectedCardId! } );

	return (
		<Button onClick={ handleClick } disabled={ isPending || !selectedCardId } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "RESERVE CARD" }
		</Button>
	);
}
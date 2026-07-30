"use client";

import { Button } from "@/shared/ui/primitives/button";
import { Spinner } from "@/shared/ui/primitives/spinner";
import { useCallbreak } from "./context";

export function PlayCard() {
	const { data, selectedCard, selectCard, playCard } = useCallbreak();
	const isPending = playCard.isPending;

	const handleClick = async () => {
		if ( selectedCard ) {
			await playCard.mutateAsync( { dealId: data.view.activeDeal?.id!, cardId: selectedCard } );
			selectCard( selectedCard );
		}
	};

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

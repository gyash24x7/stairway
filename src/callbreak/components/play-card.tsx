"use client";

import { useCallbreak } from "@/callbreak/components/context";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";

export function PlayCard() {
	const { shared, selectedCard, selectCard, playCard } = useCallbreak();
	const isPending = playCard.isPending;

	const handleClick = async () => {
		if ( selectedCard ) {
			await playCard.mutateAsync( {
				dealId: shared.state.activeDeal?.id!,
				gameId: shared.id,
				cardId: selectedCard
			} );

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

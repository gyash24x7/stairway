"use client";

import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";

export function PlayCard() {
	const { data, selectedCard, actions, isPending } = useCallbreak();
	const dealId = data.view.activeDeal?.id;

	const handleClick = () => {
		if ( selectedCard && dealId ) {
			actions.playCard( { dealId, cardId: selectedCard } );
		}
	};

	return (
		<Button
			onClick={ handleClick }
			disabled={ isPending || !selectedCard || !dealId }
			className={ "w-full max-w-lg" }
		>
			{ isPending ? <Spinner/> : "PLAY CARD" }
		</Button>
	);
}

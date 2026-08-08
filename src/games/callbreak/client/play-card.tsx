"use client";

import { Button } from "@/shared/ui/primitives/button.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { useCallbreak } from "@/games/callbreak/client/context.tsx";

export function PlayCard() {
	const { data, selectedCard, selectCard, playCard } = useCallbreak();
	const isPending = playCard.isPending;

	const handleClick = () => {
		if ( selectedCard ) {
			playCard.mutate(
				{ dealId: data.view.activeDeal?.id!, cardId: selectedCard },
				{ onSuccess: () => selectCard( selectedCard ) }
			);
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

"use client";

import { useCallbreak } from "@/callbreak/components/context";
import { playCard } from "@/callbreak/core/actions";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { useTransition } from "react";

export function PlayCard() {
	const { game, selectedCard, selectCard } = useCallbreak();
	const [ isPending, startTransition ] = useTransition();

	const handleClick = () => startTransition( async () => {
		if ( selectedCard ) {
			await playCard( {
				dealId: game.state.activeDeal?.id!,
				gameId: game.id,
				cardId: selectedCard
			} );

			selectCard( selectedCard );
		}
	} );

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

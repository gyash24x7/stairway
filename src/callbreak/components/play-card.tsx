"use client";

import { useCallbreak } from "@/callbreak/components/context";
import { playCard } from "@/callbreak/core/actions";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

export function PlayCard() {
	const { game, selectedCard, selectCard } = useCallbreak();
	const hasTrickWinner = !!game.state.activeDeal?.tricks[ 0 ]?.winner;

	const playCardFn = useServerFn( playCard );
	const { isPending, mutate } = useMutation( {
		mutationFn: playCardFn,
		onSuccess: () => selectCard( selectedCard! )
	} );

	const handleClick = () => mutate( {
		data: {
			dealId: game.state.activeDeal?.id!,
			gameId: game.id,
			cardId: selectedCard!
		}
	} );

	return (
		<Button
			onClick={ handleClick }
			disabled={ isPending || !selectedCard || hasTrickWinner }
			className={ "w-full max-w-lg" }
		>
			{ isPending ? <Spinner/> : "PLAY CARD" }
		</Button>
	);
}

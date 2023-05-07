import { Button } from "@s2h/ui";
import React from "react";
import { useGame } from "../utils/game-context";
import { trpc } from "../utils/trpc";

export function GiveCard() {
	const { id: gameId, moves } = useGame();
	const { mutateAsync, isLoading } = trpc.giveCard.useMutation();

	const giveCard = () => mutateAsync( {
		gameId,
		cardToGive: moves[ 0 ]?.askedFor!,
		giveTo: moves[ 0 ]?.askedById!
	} );

	return (
		<Button
			buttonText={ "Give Card" }
			appearance={ "success" }
			fullWidth
			isLoading={ isLoading }
			onClick={ giveCard }
		/>
	);
}
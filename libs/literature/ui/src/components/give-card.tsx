import React from "react";
import { Button } from "@s2h/ui";
import { trpc } from "../utils/trpc";
import { useGame } from "../utils/game-context";

export function GiveCard() {
	const { id: gameId, moves } = useGame();
	const { mutateAsync, isLoading } = trpc.useMutation( "give-card" );

	const giveCard = () => mutateAsync( {
		gameId,
		cardToGive: moves[ 0 ]?.askedFor!,
		giveTo: moves[ 0 ]?.askedById!
	} );

	return (
		<Button
			buttonText = { "Give Card" }
			appearance = { "success" }
			fullWidth
			isLoading = { isLoading }
			onClick = { giveCard }
		/>
	);
}
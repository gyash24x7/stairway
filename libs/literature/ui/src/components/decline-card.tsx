import { Button } from "@s2h/ui";
import { useGame } from "../utils/game-context";
import { trpc } from "../utils/trpc";
import React from "react";

export function DeclineCard() {
	const { id: gameId, moves } = useGame();
	const { mutateAsync, isLoading } = trpc.useMutation( "decline-card" );

	const declineCard = () => mutateAsync( { gameId, cardDeclined: moves[ 0 ]?.askedFor! } );

	return (
		<Button
			buttonText = { "Decline Card" }
			appearance = { "danger" }
			fullWidth
			isLoading = { isLoading }
			onClick = { declineCard }
		/>
	);
}
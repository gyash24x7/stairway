"use client";

import { useFish } from "@/fish/components/context";
import { cn } from "@/shared/utils/cn";

export function TurnIndicator() {
	const { game, isMyTurn } = useFish();

	const currentPlayerName = game.players[ game.context.currentPlayer ].name.toUpperCase();

	const lastClaim = game.state.claimHistory[ 0 ];
	const canTransfer = game.state.lastMoveType === "claim"
		&& lastClaim?.success
		&& lastClaim.playerId === game.state.playerId;

	const hasCards = game.state.hand.length > 0;

	let hint = "";
	if ( isMyTurn ) {
		if ( canTransfer ) {
			hint = "You can transfer your turn or claim another book";
		} else if ( hasCards ) {
			hint = "Ask an opponent for a card or claim a book";
		} else {
			hint = "You have no cards — claim a book for your team";
		}
	}

	return (
		<div
			className={ cn(
				"p-2 md:p-3 rounded-md w-full text-center transition-colors",
				isMyTurn ? "bg-accent text-neutral-dark" : "bg-background"
			) }
		>
			<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
				{ isMyTurn ? "YOUR TURN!" : `${ currentPlayerName }'S TURN` }
			</p>
			{ isMyTurn && hint && (
				<p className={ "text-xs md:text-sm mt-1 opacity-80" }>
					{ hint }
				</p>
			) }
		</div>
	);
}

"use client";

import { cn } from "@/shared/utils/cn";
import { useTicTacToe } from "@/tictactoe/components/context";
import { placeMove } from "@/tictactoe/core/actions";
import { useTransition } from "react";

export function Board() {
	const { game } = useTicTacToe();
	const [ isPending, startTransition ] = useTransition();

	const isMyTurn = game.context.currentPlayer === game.state.playerId;
	const gameInProgress = game.status === "IN_PROGRESS";
	const disabled = !gameInProgress || !isMyTurn || isPending;

	const handlePlace = ( position: number ) => startTransition( async () => {
		await placeMove( { gameId: game.id, position } );
	} );

	return (
		<div className={ "grid grid-cols-3 gap-2 w-full max-w-xl" }>
			{ game.state.board.map( ( cell, index ) => (
				<button
					key={ `Cell ${ index }` }
					onClick={ () => handlePlace( index ) }
					disabled={ disabled || cell !== null }
					className={ cn(
						"aspect-square border-2 border-black rounded-base flex items-center justify-center",
						"text-4xl md:text-6xl font-title transition-all",
						cell === "X" && "text-accent bg-background",
						cell === "O" && "text-foreground bg-background",
						!cell && !disabled && "hover:bg-accent/20 cursor-pointer",
						!cell && disabled && "cursor-not-allowed",
						disabled && cell && "cursor-default"
					) }
				>
					{ cell }
				</button>
			) ) }
		</div>
	);
}
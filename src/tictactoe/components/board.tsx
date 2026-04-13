"use client";

import { cn } from "@/shared/utils/cn";
import { useTicTacToe } from "@/tictactoe/components/context";
import { placeMove } from "@/tictactoe/core/actions";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

export function Board() {
	const { match } = useTicTacToe();
	const placeMoveFn = useServerFn( placeMove );
	const { isPending, mutate } = useMutation( { mutationFn: placeMoveFn } );

	const isMyTurn = match.state.ctx.currentPlayer === match.state.data.playerId;
	const matchInProgress = match.status === "IN_PROGRESS";
	const disabled = !matchInProgress || !isMyTurn || isPending;

	const handlePlace = ( position: number ) => mutate( { data: { matchId: match.id, position } } );

	return (
		<div className={ "grid grid-cols-3 gap-2 w-full max-w-xl" }>
			{ match.state.data.board.map( ( cell, index ) => (
				<button
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
"use client";

import { GameInfo } from "@/shared/components/game-info";
import { RPlayerInfoSmall } from "@/shared/components/player-info";
import { Button } from "@/shared/primitives/button";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { Board } from "@/tictactoe/components/board";
import { useTicTacToe } from "@/tictactoe/components/context";
import { addBots } from "@/tictactoe/core/actions";
import { useTransition } from "react";

export function GameView() {
	const { shared, player } = useTicTacToe();
	const [ isPending, startTransition ] = useTransition();
	const players = Object.values( shared.players );
	const isActive = shared.status === "IN_PROGRESS";
	const isCompleted = shared.status === "COMPLETED";

	const handleAddBots = () => startTransition( async () => {
		await addBots( { gameId: shared.id } );
	} );

	return (
		<div className={ "flex flex-col gap-3 items-center mb-40 max-w-6xl w-full" }>
			<GameInfo
				code={ shared.code }
				name={ "tic-tac-toe" }
				completed={ isCompleted }
			/>

			{ shared.status === "CREATED" && (
				<div
					className={ cn(
						"rounded-md bg-background p-8 text-center",
						"w-full flex flex-col gap-2 items-center"
					) }
				>
					<p className={ "text-lg font-heading" }>Waiting for opponent...</p>
					<p className={ "text-sm text-muted-foreground mb-2" }>
						Share the game code to invite a player
					</p>
					<Button onClick={ handleAddBots }>
						{ isPending ? <Spinner/> : "Add Bots" }
					</Button>
				</div>
			) }

			{ isCompleted && shared.state.winner && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					{ shared.state.winner !== "draw" ? (
						<p className={ "text-lg font-heading" }>
							{ shared.state.winner === player.playerId ? "You won!" : "You lost!" }
						</p>
					) : (
						<p className={ "text-lg font-heading" }>It's a draw!</p>
					) }
				</div>
			) }

			<Board/>

			{ players.length > 0 && (
				<div
					className={ cn(
						"flex justify-around border-2 rounded-md bg-background w-full max-w-xl"
					) }
				>
					{ players.map( ( p, index ) => (
						<div key={ p.id } className={ "flex items-center gap-2" }>
							<span className={ "text-2xl font-title" }>
								{ index === 0 ? "X" : "O" }
							</span>
							<RPlayerInfoSmall player={ p }/>
							{ shared.context.currentPlayer === p.id && isActive && (
								<span className={ "text-xs text-accent" }>●</span>
							) }
						</div>
					) ) }
				</div>
			) }
		</div>
	);
}

"use client";

import { GameInfo } from "@/shared/components/game-info";
import { RPlayerInfoSmall } from "@/shared/components/player-info";
import { Board } from "@/tictactoe/components/board";
import { useTicTacToe } from "@/tictactoe/components/context";

export function GameView() {
	const { match } = useTicTacToe();
	const players = Object.values( match.players );
	const isActive = match.status === "IN_PROGRESS";
	const isCompleted = match.status === "COMPLETED";

	return (
		<div className={ "flex flex-col gap-3 items-center mb-40 max-w-6xl w-full justify-self-center" }>
			<GameInfo
				code={ match.code }
				name={ "Tic Tac Toe" }
				completed={ isCompleted }
			/>

			{ match.status === "CREATED" && (
				<div className={ "rounded-md bg-background p-8 text-center w-full" }>
					<p className={ "text-lg font-heading" }>Waiting for opponent...</p>
					<p className={ "text-sm text-muted-foreground mt-2" }>
						Share the game code to invite a player
					</p>
				</div>
			) }

			{ isCompleted && match.result && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					{ match.result.victory && "winner" in match.result ? (
						<p className={ "text-lg font-heading" }>
							{ match.result.winner === match.state.data.playerId ? "You won!" : "You lost!" }
						</p>
					) : (
						<p className={ "text-lg font-heading" }>It's a draw!</p>
					) }
				</div>
			) }

			<Board/>

			{ players.length > 0 && (
				<div className={ "flex justify-around border-2 rounded-md bg-background w-full max-w-xl" }>
					{ players.map( ( p, index ) => (
						<div key={ p.id } className={ "flex items-center gap-2" }>
							<span className={ "text-2xl font-title" }>
								{ index === 0 ? "X" : "O" }
							</span>
							<RPlayerInfoSmall player={ p }/>
							{ match.state.ctx.currentPlayer === p.id && isActive && (
								<span className={ "text-xs text-accent" }>●</span>
							) }
						</div>
					) ) }
				</div>
			) }
		</div>
	);
}

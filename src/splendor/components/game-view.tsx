"use client";

import { GameInfo } from "@/shared/components/game-info";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { Board } from "@/splendor/components/board";
import { useSplendor } from "@/splendor/components/context";
import { PickTokens } from "@/splendor/components/pick-tokens";
import { PlayerInfo } from "@/splendor/components/player-info";

export function GameView() {
	const { game } = useSplendor();

	const isLastRound = game.status === "IN_PROGRESS" && Object.values( game.state.playerData )
		.some( player => player.points >= game.config.winningPoints );

	return (
		<div className={ `flex flex-col gap-3 items-center max-w-6xl justify-self-center w-full mb-80 lg:mb-0` }>
			<GameInfo
				code={ game.code }
				name={ "splendor" }
				completed={ game.status === "COMPLETED" }
				additionalInfo={
					<div className={ "py-2 px-4" }>
						<p className={ "text-xs md:text-sm" }>WINNING POINTS</p>
						<h2 className={ cn( "text-2xl md:text-4xl font-heading" ) }>
							{ game.config.winningPoints }
						</h2>
					</div>
				}
			/>
			{ game.status === "COMPLETED" && game.state.winner && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					<p className={ "text-lg font-heading" }>
						{ game.state.winner === game.state.playerId ? "You won!" : "You lost!" }
					</p>
				</div>
			) }
			<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full justify-items-center" }>
				<div className={ "w-full max-w-lg md:max-w-xl" }>
					<Board/>
				</div>
				<div className={ cn( "flex flex-col justify-end gap-3 w-full max-w-lg md:max-w-xl" ) }>
					{ game.status === "CREATED" && (
						<div
							className={ "p-2 md:p-3 rounded-md w-full bg-background flex flex-col gap-2 items-center" }>
							<Spinner size={ "xl" }/>
							<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
								WAITING FOR PLAYERS
							</p>
						</div>
					) }
					{ game.context.players.map( player => <PlayerInfo playerId={ player } key={ player }/> ) }
					{ game.status === "IN_PROGRESS" && isLastRound && (
						<div className={ "p-2 md:p-3 border-2 rounded-md w-full bg-surface" }>
							<p className={ "text-sm md:text-lg xl:text-xl font-semibold" }>
								THIS IS THE LAST ROUND!
							</p>
						</div>
					) }
					<div className={ "hidden lg:block" }>
						{ game.status === "IN_PROGRESS" && <PickTokens/> }
					</div>
				</div>
			</div>
			<div
				className={ cn(
					"fixed left-0 right-0 bottom-0 bg-surface",
					"rounded-t-xl flex flex-col gap-2 p-3 items-center",
					game.status === "IN_PROGRESS" && "lg:hidden"
				) }
			>
				{ game.status === "IN_PROGRESS" && <PickTokens/> }
			</div>
		</div>
	);
}
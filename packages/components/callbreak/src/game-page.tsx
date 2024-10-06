import { cn } from "@base/components";
import { useDeal, useGameCode, useGameStatus, useHand, usePlayers, useRound } from "@callbreak/store";
import { DisplayCard, DisplayHand, DisplayPlayer, GameCode } from "@main/components";
import { CardHand, PlayingCard } from "@stairway/cards";
import { ActionPanel } from "./action-panel.tsx";
import { DisplayScore } from "./display-score.tsx";
import { GameCompleted } from "./game-completed.tsx";
import { PlayerLobby } from "./player-lobby.tsx";

export function GamePage() {
	const players = usePlayers();
	const status = useGameStatus();
	const code = useGameCode();
	const hand = useHand();
	const deal = useDeal();
	const round = useRound();

	const playerOrder = round?.playerOrder ?? deal?.playerOrder ?? Object.keys( players );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ deal?.status !== "IN_PROGRESS" && <PlayerLobby withBg/> }
				<DisplayScore/>
				{ status === "IN_PROGRESS" && deal?.status === "IN_PROGRESS" && (
					<div className={ "rounded-md p-3 border-2 relative min-h-80 flex items-center justify-center" }>
						{ Object.keys( players ).map( ( player, i ) => (
							<div
								key={ player }
								className={ cn(
									"absolute h-1/3 w-1/3 max-w-md flex justify-center items-center bg-muted p-2",
									i === 0 && "top-0 left-0",
									i === 1 && "top-0 right-0",
									i === 2 && "bottom-0 right-0",
									i === 3 && "bottom-0 left-0",
									deal?.playerOrder[ deal.turnIdx ] === player && "border-2 border-primary",
									round?.playerOrder[ round.turnIdx ] === player && "border-2 border-primary"
								) }
							>
								<DisplayPlayer player={ players[ player ]! }/>
							</div>
						) ) }
						{ !!round && (
							<div className={ "grid gap-2 py-2 grid-cols-2 lg:grid-cols-4" }>
								{ playerOrder.map( player => {
									console.log( round.cards );
									if ( !round.cards[ player ] ) {
										return;
									}

									const card = PlayingCard.fromId( round.cards[ player ]! );
									return (
										<div className={ "flex w-full justify-center" } key={ player }>
											<DisplayCard rank={ card.rank } suit={ card.suit } key={ card.id }/>
										</div>
									);
								} ) }
							</div>
						) }
					</div>
				) }
				{ status === "IN_PROGRESS" && <DisplayHand hand={ CardHand.from( hand.serialize() ) }/> }
				{ status === "COMPLETED" && <GameCompleted/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}
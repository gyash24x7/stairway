import { cn } from "@base/components";
import { getCardFromId } from "@stairway/cards";
import { DisplayCard, DisplayHand, DisplayPlayer, GameCode } from "@main/components";
import {
	useCurrentDeal,
	useCurrentRound,
	useGameCode,
	useGameStatus,
	useHand,
	usePlayers
} from "@callbreak/store";
import { ActionPanel } from "./action-panel";
import { DisplayScore } from "./display-score";
import { GameCompleted } from "./game-completed";
import { PlayerLobby } from "./player-lobby";

export function GamePage() {
	const players = usePlayers();
	const status = useGameStatus();
	const code = useGameCode();
	const hand = useHand();
	const deal = useCurrentDeal();
	const round = useCurrentRound();

	const playerOrder = round?.playerOrder ?? deal?.playerOrder ?? Object.keys( players );

	return (
		<div className={ `flex flex-col gap-3` }>
			<GameCode code={ code }/>
			<div className={ "flex flex-col gap-3 justify-between mb-52" }>
				{ deal?.status !== "IN_PROGRESS" && <PlayerLobby withBg/> }
				<DisplayScore/>
				{ status === "IN_PROGRESS" && deal?.status === "IN_PROGRESS" && (
					<div
						className={ "rounded-md p-3 border-2 relative min-h-80 flex items-center justify-center" }>
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
									if ( !round.cards[ player ] ) {
										return;
									}

									const cardId = round.cards[ player ]!;
									const card = getCardFromId( cardId );
									return (
										<div className={ "flex w-full justify-center" } key={ player }>
											<DisplayCard rank={ card.rank } suit={ card.suit } key={ cardId }/>
										</div>
									);
								} ) }
							</div>
						) }
					</div>
				) }
				{ status === "IN_PROGRESS" && <DisplayHand hand={ hand }/> }
				{ status === "COMPLETED" && <GameCompleted/> }
			</div>
			{ status !== "COMPLETED" && <ActionPanel/> }
		</div>
	);
}
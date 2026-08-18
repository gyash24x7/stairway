"use client";

import { Fragment } from "react";

import { ActionPanel } from "@/games/callbreak/client/action-panel.tsx";
import { useCallbreak } from "@/games/callbreak/client/context.tsx";
import { DealView } from "@/games/callbreak/client/deal-view.tsx";
import { HandView } from "@/games/callbreak/client/hand-view.tsx";
import { Scores } from "@/games/callbreak/client/scores.tsx";
import { CALLBREAK_TRICKS_PER_DEAL } from "@/games/callbreak/shared/schema.ts";
import { RCardSuit } from "@/shared/ui/components/card.tsx";
import { GameInfo } from "@/swish/client/game-info.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { GameStatusPanel } from "@/swish/client/game-status-panel.tsx";
import { PlayerLobbyGrid } from "@/swish/client/player-lobby.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { TurnBanner } from "@/swish/client/turn-banner.tsx";

export function GameView() {
	const { data, playerId, isMyTurn } = useCallbreak();

	const isCompleted = data.status === "COMPLETED";
	const activeDeal = data.view.activeDeal;
	const completedTricks = activeDeal?.tricks.filter( t => !!t.winner ) ?? [];
	const nonBotPlayers = data.context.players.filter( pid => !data.players[ pid ].isBot );

	return (
		<div className={ "flex flex-col gap-3 w-full max-w-6xl" }>
			<GameInfo
				id={ data.id }
				code={ data.code }
				name={ "callbreak" }
				showChat={ nonBotPlayers.length > 1 }
				completed={ isCompleted }
				additionalInfo={
					<Fragment>
						<StatBlock label={ "TRUMP" }>
							<RCardSuit suit={ data.config.trumpSuit } large themed/>
						</StatBlock>
						<StatBlock label={ "COMPLETED DEALS" }>
							{ data.view.dealsPlayed }/{ data.config.dealCount }
						</StatBlock>
						<StatBlock label={ "COMPLETED TRICKS" }>
							{ completedTricks.length }/{ CALLBREAK_TRICKS_PER_DEAL }
						</StatBlock>
					</Fragment>
				}
				deadline={ data.deadline }
				couchSupport
			/>
			<div className={ "flex flex-col gap-3" }>
				<GameStandings
					results={ data.results }
					players={ data.players }
					playerId={ playerId }
					scoreLabel={ "SCORE" }
				/>

				<TurnBanner
					status={ data.status }
					players={ data.players }
					currentPlayer={ data.context.currentPlayer }
					isMyTurn={ isMyTurn }
					action={ data.context.phase === "DECLARING" ? "DECLARING" : undefined }
				/>

				{ !!activeDeal && ( isCompleted
					? <DealView/>
					: (
						<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3" }>
							<Scores/>
							<DealView/>
						</div>
					) ) }
				{ !!activeDeal && !isCompleted && !!playerId && <HandView/> }
				{ !activeDeal && (
					<PlayerLobbyGrid players={ data.context.players.map( id => data.players[ id ] ) }/>
				) }
				<GameStatusPanel
					status={ data.status }
					seated={ data.context.players.length }
					playerCount={ data.config.playerCount }
				/>
			</div>
			{ !isCompleted && <ActionPanel/> }
		</div>
	);
}

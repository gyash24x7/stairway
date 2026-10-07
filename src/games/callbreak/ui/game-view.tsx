import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { Fragment, useState } from "react";

import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/schema";
import { CALLBREAK_TRICKS_PER_DEAL } from "@/games/callbreak/schema";
import { ActionPanel } from "@/games/callbreak/ui/action-panel";
import { addBotsAtom, rematchAtom, startGameAtom } from "@/games/callbreak/ui/client";
import { DealView } from "@/games/callbreak/ui/deal-view";
import { HandView } from "@/games/callbreak/ui/hand-view";
import { Scores } from "@/games/callbreak/ui/scores";
import { RCardSuit } from "@/shared/shell/card";
import type { CardId } from "@/shared/utils/cards";
import type { GameView, PlayerId } from "@/swish/schema";
import { GameId } from "@/swish/schema";
import { GameInfo } from "@/swish/ui/game-info";
import { GameStandings } from "@/swish/ui/game-standings";
import { GameStatusPanel } from "@/swish/ui/game-status-panel";
import { PlayerLobbyGrid } from "@/swish/ui/player-lobby";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, StartGame } from "@/swish/ui/seat-controls";
import { StatBlock } from "@/swish/ui/stat-block";
import { TurnBanner } from "@/swish/ui/turn-banner";

type Game = GameView<CallbreakView, CallbreakConfig>;

export type CallbreakGameViewProps = {
	readonly game: Game;
	readonly gameId: string;
	readonly me: PlayerId;
};

export function CallbreakGameView( { game, gameId, me }: CallbreakGameViewProps ) {
	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const start = useAtomSet( startGameAtom, { mode: "promiseExit" } );

	const params = { gameId: GameId.make( gameId ) };
	const adding = useAtomValue( addBotsAtom ).waiting;
	const starting = useAtomValue( startGameAtom ).waiting;

	const [ selectedCard, setSelectedCard ] = useState<CardId>();

	const isCompleted = game.status === "COMPLETED";
	const isMyTurn = game.status === "IN_PROGRESS" && game.context.currentPlayer === me;
	const hasSeat = game.context.players.includes( me );
	const activeDeal = game.view.activeDeal;
	const completedTricks = activeDeal?.tricks.filter( t => !!t.winner ) ?? [];
	const nonBotPlayers = game.context.players.filter( pid => !game.players[ pid ]?.isBot );

	return (
		<div className={ "flex flex-col gap-3 w-full max-w-6xl" }>
			<GameInfo
				id={ game.id }
				deadline={ game.runtime.deadline }
				spectators={ game.runtime.spectators }
				name={ "callbreak" }
				showChat={ nonBotPlayers.length > 1 }
				completed={ isCompleted }
				additionalInfo={
					<Fragment>
						<StatBlock label={ "TRUMP" }>
							<RCardSuit suit={ game.config.trumpSuit } large themed/>
						</StatBlock>
						<StatBlock label={ "COMPLETED DEALS" }>
							{ game.view.dealsPlayed }/{ game.config.dealCount }
						</StatBlock>
						<StatBlock label={ "COMPLETED TRICKS" }>
							{ completedTricks.length }/{ CALLBREAK_TRICKS_PER_DEAL }
						</StatBlock>
					</Fragment>
				}
				couchSupport
			/>
			<div className={ "flex flex-col gap-3" }>
				<GameStandings
					results={ game.results }
					players={ game.players }
					playerId={ me }
					scoreLabel={ "SCORE" }
				/>
				<RematchPanel
					game={ "callbreak" }
					gameId={ game.id }
					status={ game.status }
					rematch={ game.runtime.rematch }
					seated={ hasSeat }
					rematchAtom={ rematchAtom }
				/>

				<TurnBanner
					status={ game.status }
					players={ game.players }
					currentPlayer={ game.context.currentPlayer }
					isMyTurn={ isMyTurn }
					action={ game.context.phase === "declaring" ? "DECLARING" : undefined }
				/>

				{ !!activeDeal && ( isCompleted
					? <DealView game={ game }/>
					: (
						<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3" }>
							<Scores game={ game }/>
							<DealView game={ game }/>
						</div>
					) ) }
				{ !!activeDeal && !isCompleted && hasSeat && (
					<HandView
						game={ game }
						isMyTurn={ isMyTurn }
						selectedCard={ selectedCard }
						onSelectCard={ setSelectedCard }
					/>
				) }
				{ !activeDeal && (
					<PlayerLobbyGrid
						players={ game.context.players.flatMap( id => game.players[ id ]
							? [ game.players[ id ] ]
							: [] ) }
						seats={ game.config.playerCount }
					/>
				) }
				<GameStatusPanel
					status={ game.status }
					seated={ game.context.players.length }
					playerCount={ game.config.playerCount }
				>
					{ hasSeat && game.status === "CREATED" && (
						<AddBots
							addBots={ () => void addBots( { params } ) }
							disabled={ adding }
						/>
					) }
					{ hasSeat && game.status === "PLAYERS_READY" && (
						<StartGame
							startGame={ () => void start( { params } ) }
							disabled={ starting }
						/>
					) }
				</GameStatusPanel>
			</div>
			{ !isCompleted && hasSeat && (
				<ActionPanel
					game={ game }
					gameId={ gameId }
					me={ me }
					selectedCard={ selectedCard }
					onPlayed={ () => setSelectedCard( undefined ) }
				/>
			) }
		</div>
	);
}

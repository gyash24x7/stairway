"use client";

import { ActionPanel } from "@/games/coup/client/action-panel.tsx";
import { ActivityLog } from "@/games/coup/client/activity-log.tsx";
import { useCoup } from "@/games/coup/client/context.tsx";
import { ReactionPrompt } from "@/games/coup/client/reaction-prompt.tsx";
import { SeatsView } from "@/games/coup/client/seats-view.tsx";
import { ActionBar } from "@/swish/client/action-bar.tsx";
import { GameInfo } from "@/swish/client/game-info.tsx";
import { GameStandings } from "@/swish/client/game-standings.tsx";
import { GameStatusPanel } from "@/swish/client/game-status-panel.tsx";
import { PlayerLobbyGrid } from "@/swish/client/player-lobby.tsx";
import { Rematch } from "@/swish/client/rematch.tsx";
import { AddBots, AutoPlayToggle } from "@/swish/client/seat-controls.tsx";
import { StartGame } from "@/swish/client/start-game.tsx";
import { StatBlock } from "@/swish/client/stat-block.tsx";
import { TurnBanner } from "@/swish/client/turn-banner.tsx";

export function GameView() {
	const {
		data,
		playerId,
		isMyTurn,
		frame,
		addBots,
		startGame,
		setAutoPlay,
		startRematch,
		isPending
	} = useCoup();

	const isPlaying = data.status === "IN_PROGRESS";
	const isLobby = data.status === "CREATED" || data.status === "PLAYERS_READY";
	const autoPlaying = !!playerId && ( data.autoPlay[ playerId ] ?? false );
	const nonBotPlayers = data.context.players.filter( id => !data.players[ id ].isBot );

	// While a window is open the turn is suspended rather than spent, so the
	// banner says what the table is actually waiting for instead of naming a
	// player who cannot currently act.
	const waitingOn = frame
		? frame.responders.filter( id => !( id in frame.responses ) )
			.map( id => data.players[ id ]?.name ?? "someone" )
		: [];

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full" }>
			<GameInfo
				id={ data.id }
				code={ data.code }
				name={ "coup" }
				completed={ data.status === "COMPLETED" }
				additionalInfo={
					<StatBlock label={ "DECK" }>{ data.view.deckCount }</StatBlock>
				}
				deadline={ frame?.deadline ?? data.deadline }
				couchSupport
				showChat={ nonBotPlayers.length > 1 }
			/>

			<GameStandings
				results={ data.results }
				players={ data.players }
				playerId={ playerId }
			/>

			<Rematch
				game={ "coup" }
				completed={ data.status === "COMPLETED" }
				rematch={ data.rematch }
				startRematch={ playerId ? startRematch : undefined }
				humans={ nonBotPlayers.length }
				disabled={ isPending }
			/>

			{ isLobby && (
				<PlayerLobbyGrid players={ data.context.players.map( id => data.players[ id ] ) }/>
			) }

			<GameStatusPanel
				status={ data.status }
				seated={ data.context.players.length }
				playerCount={ data.config.playerCount }
			>
				{ data.status === "CREATED" && !!playerId && (
					<AddBots addBots={ addBots } disabled={ isPending }/>
				) }
				{ data.status === "PLAYERS_READY" && !!playerId && (
					<StartGame startGame={ startGame } disabled={ isPending }/>
				) }
			</GameStatusPanel>

			<TurnBanner
				status={ data.status }
				players={ data.players }
				currentPlayer={ data.context.currentPlayer }
				isMyTurn={ isMyTurn }
				note={ waitingOn.length > 0 ? `WAITING ON ${ waitingOn.join( ", " ) }` : undefined }
			/>

			{ isPlaying && (
				<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-4 w-full" }>
					<SeatsView/>
					<ActivityLog/>
				</div>
			) }

			{ /* Controls only. This seat's cards are in the grid above, where every
			     other seat's are — there is nothing to duplicate down here. */ }
			{ isPlaying && !!playerId && (
				<ActionBar>
					<AutoPlayToggle
						autoPlaying={ autoPlaying }
						setAutoPlay={ setAutoPlay }
						disabled={ isPending }
					/>
					<ActionPanel/>
				</ActionBar>
			) }

			<ReactionPrompt/>
		</div>
	);
}

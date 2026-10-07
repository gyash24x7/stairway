import * as HashSet from "effect/HashSet";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useState } from "react";

import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/schema";
import { addBotsAtom, autoPlayAtom, rematchAtom, startGameAtom } from "@/games/callbreak/ui/client";
import { DeclarationsRow } from "@/games/callbreak/ui/declarations-row";
import { DeclareWins } from "@/games/callbreak/ui/declare-wins";
import { HandView } from "@/games/callbreak/ui/hand-view";
import { CallbreakHint } from "@/games/callbreak/ui/hint";
import { PlayCard } from "@/games/callbreak/ui/play-card";
import { SuitBar } from "@/games/callbreak/ui/suit-bar";
import { TrickStrip } from "@/games/callbreak/ui/trick-strip";
import type { CardId } from "@/shared/utils/cards";
import type { GameView, PlayerId } from "@/swish/schema";
import { AutoPlayInput, GameId } from "@/swish/schema";
import { ControllerShell } from "@/swish/ui/controller-shell";
import { GameStandings } from "@/swish/ui/game-standings";
import { PlayerLobbyGrid } from "@/swish/ui/player-lobby";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, AutoPlayToggle, StartGame } from "@/swish/ui/seat-controls";


type Game = GameView<CallbreakView, CallbreakConfig>;

export type ControllerViewProps = {
	readonly game: Game;
	readonly gameId: string;
	readonly me: PlayerId;
};

/**
 * The phone half. Your hand plus the compact trick context; the four seats, the
 * turn order and the winner animations are on the television.
 */
export function ControllerView( { game, gameId, me }: ControllerViewProps ) {
	const [ selectedCard, setSelectedCard ] = useState<CardId>();

	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const start = useAtomSet( startGameAtom, { mode: "promiseExit" } );
	const autoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );

	const adding = useAtomValue( addBotsAtom ).waiting;
	const starting = useAtomValue( startGameAtom ).waiting;
	const switching = useAtomValue( autoPlayAtom ).waiting;

	const params = { gameId: GameId.make( gameId ) };

	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const isPlaying = game.status === "IN_PROGRESS";
	const isMyTurn = isPlaying && game.context.currentPlayer === me;
	const hasSeat = game.players[ me ] !== undefined;
	const phase = game.context.phase;
	const dealId = game.view.activeDeal?.id;

	const waitingFor = game.context.currentPlayer
		? game.players[ game.context.currentPlayer ]?.name
		: undefined;
	const autoPlaying = HashSet.has( game.runtime.autoPlay, me );

	return (
		<ControllerShell
			game={ "callbreak" }
			deadline={ game.runtime.deadline }
			isMyTurn={ isMyTurn || isLobby }
			waitingFor={ waitingFor }
			completed={ game.status === "COMPLETED" }
			persistentActions={ isPlaying && hasSeat && (
				<>
					<AutoPlayToggle
						autoPlaying={ autoPlaying }
						setAutoPlay={ enabled => void autoPlay( {
							params,
							payload: AutoPlayInput.make( { enabled } )
						} ) }
						disabled={ switching }
					/>
					<CallbreakHint gameId={ gameId } disabled={ !isMyTurn }/>
				</>
			) }
			actions={
				<>
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
					{ isPlaying && !autoPlaying && phase === "declaring" && isMyTurn && (
						<DeclareWins gameId={ gameId } dealId={ dealId }/>
					) }
					{ isPlaying && !autoPlaying && phase === "playing" && isMyTurn && (
						<PlayCard
							gameId={ gameId }
							dealId={ dealId }
							selectedCard={ selectedCard }
							onPlayed={ () => setSelectedCard( undefined ) }
						/>
					) }
				</>
			}
		>
			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<p className={ "text-lg font-heading text-center" }>YOU&apos;RE SEATED</p>
					<PlayerLobbyGrid
						players={ game.context.players.flatMap( id => game.players[ id ]
							? [ game.players[ id ] ]
							: [] ) }
						seats={ game.config.playerCount }
					/>
				</div>
			) }

			{ isPlaying && (
				<div className={ "flex flex-col gap-3 w-full" }>
					<SuitBar game={ game }/>
					{ phase === "declaring"
						? <DeclarationsRow game={ game }/>
						: <TrickStrip game={ game }/> }
					<HandView
						game={ game }
						isMyTurn={ isMyTurn }
						selectedCard={ selectedCard }
						onSelectCard={ setSelectedCard }
					/>
				</div>
			) }

			{ game.status === "COMPLETED" && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
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
						surface={ "controller" }
					/>
				</div>
			) }
		</ControllerShell>
	);
}

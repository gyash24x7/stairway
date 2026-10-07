import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { Fragment } from "react";

import type { FishConfig, FishView } from "@/games/fish/schema";
import { ActivityFeed } from "@/games/fish/ui/activity-feed";
import { AskCard } from "@/games/fish/ui/ask-card";
import { BooksTracker } from "@/games/fish/ui/books-tracker";
import { ClaimBook } from "@/games/fish/ui/claim-book";
import { addBotsAtom, autoPlayAtom, rematchAtom, startGameAtom } from "@/games/fish/ui/client";
import { HandView } from "@/games/fish/ui/hand-view";
import { FishHint } from "@/games/fish/ui/hint";
import { GameMetrics } from "@/games/fish/ui/metrics";
import { TeamLobby } from "@/games/fish/ui/team-lobby";
import { TeamsView } from "@/games/fish/ui/teams-view";
import { TransferTurn } from "@/games/fish/ui/transfer-turn";
import { canTransferTurn } from "@/games/fish/utils";
import { toast } from "@/shared/primitives/sonner";
import { causeMessage } from "@/shared/shell/errors";
import type { GameView, PlayerId } from "@/swish/schema";
import { AutoPlayInput, GameId } from "@/swish/schema";
import { ActionBar } from "@/swish/ui/action-bar";
import { GameInfo } from "@/swish/ui/game-info";
import { GameStandings } from "@/swish/ui/game-standings";
import { GameStatusPanel } from "@/swish/ui/game-status-panel";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, AutoPlayToggle, StartGame } from "@/swish/ui/seat-controls";
import { StatBlock } from "@/swish/ui/stat-block";
import { TurnBanner } from "@/swish/ui/turn-banner";


type Game = GameView<FishView, FishConfig>;

const report = ( exit: Exit.Exit<unknown, unknown> ) => {
	if ( Exit.isFailure( exit ) ) {
		toast.error( causeMessage( exit.cause ) );
	}
};

export type FishGameViewProps = {
	readonly game: Game;
	readonly gameId: string;
	readonly me: PlayerId;
};

export function FishGameView( { game, gameId, me }: FishGameViewProps ) {
	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const start = useAtomSet( startGameAtom, { mode: "promiseExit" } );
	const autoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );

	const adding = useAtomValue( addBotsAtom ).waiting;
	const starting = useAtomValue( startGameAtom ).waiting;
	const switching = useAtomValue( autoPlayAtom ).waiting;

	const params = { gameId: GameId.make( gameId ) };

	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const isPlaying = game.status === "IN_PROGRESS";
	const isCompleted = game.status === "COMPLETED";

	const hasCards = game.view.hand.length > 0;
	const canTransfer = canTransferTurn( game.view, me );
	const autoPlaying = HashSet.has( game.runtime.autoPlay, me );
	const isMyTurn = isPlaying && game.context.currentPlayer === me;

	const seated = game.context.players.length;
	// `hand` comes back empty for a watcher because it is redacted, not because
	// the cards are gone — so nothing may key off the hand being empty. Anything
	// addressed to a player is gated on actually holding a seat.
	const hasSeat = game.players[ me ] !== undefined;
	const nonBotPlayers = game.context.players.filter( pid => !game.players[ pid ]?.isBot );

	const undecided = game.context.players.filter(
		pid => game.context.teams[ pid ] === undefined
	).length;

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full" }>
			<GameInfo
				id={ game.id }
				deadline={ game.runtime.deadline }
				spectators={ game.runtime.spectators }
				name={ "fish" }
				showChat={ nonBotPlayers.length > 1 }
				completed={ isCompleted }
				additionalInfo={
					<Fragment>
						<StatBlock label={ "TYPE" }>{ game.config.type }</StatBlock>
						<StatBlock label={ "TEAMS" }>{ game.config.teams.length }</StatBlock>
					</Fragment>
				}
			/>

			<GameStandings
				results={ game.results }
				players={ game.players }
				teamNames={ game.context.teamNames }
				playerId={ me }
				scoreLabel={ "BOOKS" }
			/>
			<RematchPanel
				game={ "fish" }
				gameId={ game.id }
				status={ game.status }
				rematch={ game.runtime.rematch }
				seated={ hasSeat }
				rematchAtom={ rematchAtom }
				teams
			/>

			{ isCompleted && <BooksTracker game={ game }/> }
			{ isCompleted && <GameMetrics game={ game }/> }

			{ isLobby && (
				<div className={ "flex flex-col gap-3 w-full items-center" }>
					<GameStatusPanel
						status={ game.status }
						seated={ seated }
						playerCount={ game.config.playerCount }
						hint={ undecided > 0
							? `${ undecided } of ${ seated } haven't picked a side — `
							+ "they'll be split evenly when the game starts."
							: "Every seat has a side. Start when you're ready." }
					>
						{ hasSeat && game.status === "CREATED" && (
							<AddBots
								addBots={ async () => report(
									await addBots( { params } )
								) }
								disabled={ adding }
							/>
						) }
						{ hasSeat && game.status === "PLAYERS_READY" && (
							<StartGame
								startGame={ async () => report(
									await start( { params } )
								) }
								disabled={ starting }
							/>
						) }
					</GameStatusPanel>
					<TeamLobby game={ game } me={ me } gameId={ gameId } readOnly={ !hasSeat }/>
				</div>
			) }

			{ isPlaying && <TeamsView game={ game } me={ me }/> }

			<TurnBanner
				status={ game.status }
				players={ game.players }
				currentPlayer={ game.context.currentPlayer }
				isMyTurn={ isMyTurn }
			/>

			{ isPlaying && ( hasSeat
				? (
					<div className={ "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full" }>
						<HandView game={ game }/>
						<ActivityFeed game={ game }/>
					</div>
				)
				: (
					<div className={ "w-full" }>
						<ActivityFeed game={ game }/>
					</div>
				) ) }

			{ !isCompleted && hasSeat && (
				<ActionBar>
					{ isPlaying && (
						<AutoPlayToggle
							autoPlaying={ autoPlaying }
							setAutoPlay={ async enabled => report( await autoPlay( {
								params,
								payload: AutoPlayInput.make( { enabled } )
							} ) ) }
							disabled={ switching }
						/>
					) }
					{ isPlaying && (
						<FishHint game={ game } gameId={ gameId } disabled={ !isMyTurn }/>
					) }
					{ isPlaying && isMyTurn && !autoPlaying && hasCards && (
						<AskCard game={ game } me={ me } gameId={ gameId }/>
					) }
					{ isPlaying && isMyTurn && !autoPlaying && (
						<ClaimBook game={ game } me={ me } gameId={ gameId }/>
					) }
					{ isPlaying && isMyTurn && !autoPlaying && canTransfer && (
						<TransferTurn game={ game } me={ me } gameId={ gameId }/>
					) }
				</ActionBar>
			) }
		</div>
	);
}

import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { Fragment, useEffect, useState } from "react";

import type {
	CoupActionName,
	CoupCard,
	CoupConfig,
	CoupView,
	StealBlocker
} from "@/games/coup/schema";
import { CoupActionPanel } from "@/games/coup/ui/action-panel";
import {
	addBotsAtom,
	assassinateAtom,
	autoPlayAtom,
	blockAssassinationAtom,
	blockForeignAidAtom,
	blockStealAtom,
	challengeAtom,
	coupAtom,
	exchangeAtom,
	exchangeReturnAtom,
	foreignAidAtom,
	incomeAtom,
	passAtom,
	rematchAtom,
	revealAtom,
	startGameAtom,
	stealAtom,
	taxAtom
} from "@/games/coup/ui/client";
import { CoupHandView } from "@/games/coup/ui/hand-view";
import { CoupHint } from "@/games/coup/ui/hint";
import { PendingBanner } from "@/games/coup/ui/pending-banner";
import { CoupPlayerRow } from "@/games/coup/ui/player-row";
import { CoupResponsePanel } from "@/games/coup/ui/response-panel";
import { toast } from "@/shared/primitives/sonner";
import { causeMessage } from "@/shared/shell/errors";
import type { GameView, PlayerId } from "@/swish/schema";
import { AutoPlayInput, GameId, PassInteractionInput } from "@/swish/schema";
import { ActionBar } from "@/swish/ui/action-bar";
import { GameInfo } from "@/swish/ui/game-info";
import { GameStandings } from "@/swish/ui/game-standings";
import { GameStatusPanel } from "@/swish/ui/game-status-panel";
import { PlayerLobbyGrid } from "@/swish/ui/player-lobby";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, AutoPlayToggle, StartGame } from "@/swish/ui/seat-controls";
import { StatBlock } from "@/swish/ui/stat-block";
import { TurnBanner } from "@/swish/ui/turn-banner";
import { activeFrame } from "@/swish/utils";


type Game = GameView<CoupView, CoupConfig>;

/**
 * Surfaces a refused move.
 *
 * Coup refuses more than the other games do, and for reasons a player cannot
 * always see coming — a window that settled while they were reading it, a target
 * who lost their last influence a moment ago. Swallowing those would leave a
 * button that looks like it did nothing.
 */
const report = ( exit: Exit.Exit<unknown, unknown> ) => {
	if ( Exit.isFailure( exit ) ) {
		toast.error( causeMessage( exit.cause ) );
	}
};

export type CoupGameViewProps = {
	readonly game: Game;
	readonly gameId: string;
	readonly me: PlayerId;
};

export function CoupGameView( { game, gameId, me }: CoupGameViewProps ) {
	// The aimed action being composed, and who it is aimed at. Held here rather
	// than in the action panel because the target is picked on the seats, which
	// are a sibling of it.
	const [ armed, setArmed ] = useState<CoupActionName>();
	const [ target, setTarget ] = useState<PlayerId>();

	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const start = useAtomSet( startGameAtom, { mode: "promiseExit" } );
	const setAutoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );

	const income = useAtomSet( incomeAtom, { mode: "promiseExit" } );
	const foreignAid = useAtomSet( foreignAidAtom, { mode: "promiseExit" } );
	const coup = useAtomSet( coupAtom, { mode: "promiseExit" } );
	const tax = useAtomSet( taxAtom, { mode: "promiseExit" } );
	const assassinate = useAtomSet( assassinateAtom, { mode: "promiseExit" } );
	const steal = useAtomSet( stealAtom, { mode: "promiseExit" } );
	const exchange = useAtomSet( exchangeAtom, { mode: "promiseExit" } );

	const challenge = useAtomSet( challengeAtom, { mode: "promiseExit" } );
	const blockForeignAid = useAtomSet( blockForeignAidAtom, { mode: "promiseExit" } );
	const blockAssassination = useAtomSet( blockAssassinationAtom, { mode: "promiseExit" } );
	const blockSteal = useAtomSet( blockStealAtom, { mode: "promiseExit" } );
	const reveal = useAtomSet( revealAtom, { mode: "promiseExit" } );
	const exchangeReturn = useAtomSet( exchangeReturnAtom, { mode: "promiseExit" } );
	const pass = useAtomSet( passAtom, { mode: "promiseExit" } );

	// Read one at a time and combined afterwards: `||` short-circuits, and a hook
	// behind a short-circuit is a hook that is sometimes not called at all.
	const incomeWaiting = useAtomValue( incomeAtom ).waiting;
	const foreignAidWaiting = useAtomValue( foreignAidAtom ).waiting;
	const coupWaiting = useAtomValue( coupAtom ).waiting;
	const taxWaiting = useAtomValue( taxAtom ).waiting;
	const assassinateWaiting = useAtomValue( assassinateAtom ).waiting;
	const stealWaiting = useAtomValue( stealAtom ).waiting;
	const exchangeWaiting = useAtomValue( exchangeAtom ).waiting;

	const challengeWaiting = useAtomValue( challengeAtom ).waiting;
	const blockForeignAidWaiting = useAtomValue( blockForeignAidAtom ).waiting;
	const blockAssassinationWaiting = useAtomValue( blockAssassinationAtom ).waiting;
	const blockStealWaiting = useAtomValue( blockStealAtom ).waiting;
	const revealWaiting = useAtomValue( revealAtom ).waiting;
	const exchangeReturnWaiting = useAtomValue( exchangeReturnAtom ).waiting;
	const passWaiting = useAtomValue( passAtom ).waiting;

	const acting = incomeWaiting || foreignAidWaiting || coupWaiting || taxWaiting
		|| assassinateWaiting || stealWaiting || exchangeWaiting;

	const responding = challengeWaiting || blockForeignAidWaiting || blockAssassinationWaiting
		|| blockStealWaiting || revealWaiting || exchangeReturnWaiting || passWaiting;

	const adding = useAtomValue( addBotsAtom ).waiting;
	const starting = useAtomValue( startGameAtom ).waiting;
	const switching = useAtomValue( autoPlayAtom ).waiting;

	const params = { gameId: GameId.make( gameId ) };

	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const isPlaying = game.status === "IN_PROGRESS";
	const isCompleted = game.status === "COMPLETED";

	const frame = activeFrame( game.context );
	const isMyTurn = isPlaying && game.context.currentPlayer === me;
	const autoPlaying = HashSet.has( game.runtime.autoPlay, me );
	const isOut = game.view.eliminated.includes( me );
	// A watcher holds no influence, no coins and no turn. Everything below that
	// belongs to a seat is gated on this rather than on the emptiness of the
	// data: a spectator's hand comes back empty by redaction, so a panel that
	// only checked the cards would still announce itself as theirs.
	const hasSeat = game.players[ me ] !== undefined;

	// A turn is only actionable between windows: while one is open the turn is
	// suspended, and the seven actions belong to whoever the window resolves to.
	const canAct = isMyTurn && !frame && !autoPlaying && !isOut;

	// Whether the open window is one this seat has to answer. It decides where the
	// panel is rendered: a question put to you belongs in the bar under your thumb,
	// and one put to somebody else belongs up with the claim it is about.
	const waitingOnMe = !!frame && frame.pending.includes( me );

	const seats = game.context.players.flatMap( id => {
		const player = game.players[ id ];
		return player ? [ player ] : [];
	} );
	const aliveOthers = game.context.players.filter(
		id => id !== me && !game.view.eliminated.includes( id )
	);

	const nonBotPlayers = game.context.players.filter( pid => !game.players[ pid ]?.isBot );

	/**
	 * Every response carries the id of the window it is answering.
	 *
	 * One answer can settle a window and open the next in the same commit, so a
	 * tap made against the window on screen can land while its successor is open.
	 * Naming the frame turns that into a refusal the player is told about rather
	 * than an answer to a question they never read.
	 */
	const respondQuery = frame ? { frame: frame.id } : {};

	// A composed action does not survive the turn it was composed on. Coming back
	// to your seat with a half-aimed Steal still armed would put the table straight
	// into target-picking for a move you decided against two turns ago.
	useEffect( () => {
		if ( !canAct ) {
			setArmed( undefined );
			setTarget( undefined );
		}
	}, [ canAct ] );

	const clearArmed = () => {
		setArmed( undefined );
		setTarget( undefined );
	};

	const play = ( action: CoupActionName, aimedAt?: PlayerId ) => {
		clearArmed();

		if ( action === "income" ) {
			void income( { params, payload: {} } ).then( report );
		} else if ( action === "foreignAid" ) {
			void foreignAid( { params, payload: {} } ).then( report );
		} else if ( action === "tax" ) {
			void tax( { params, payload: {} } ).then( report );
		} else if ( action === "exchange" ) {
			void exchange( { params, payload: {} } ).then( report );
		} else if ( aimedAt ) {
			const payload = { target: aimedAt };
			const send = action === "coup" ? coup : action === "assassinate" ? assassinate : steal;
			void send( { params, payload } ).then( report );
		}
	};

	const respond = {
		onChallenge: () => void challenge( {
			params, query: respondQuery, payload: {}
		} ).then( report ),
		onBlockForeignAid: () => void blockForeignAid( {
			params, query: respondQuery, payload: {}
		} ).then( report ),
		onBlockAssassination: () => void blockAssassination( {
			params, query: respondQuery, payload: {}
		} ).then( report ),
		onBlockSteal: ( claim: StealBlocker ) => void blockSteal( {
			params, query: respondQuery, payload: { claim }
		} ).then( report ),
		onReveal: ( card: CoupCard ) => void reveal( {
			params, query: respondQuery, payload: { card }
		} ).then( report ),
		onExchangeReturn: ( cards: ReadonlyArray<CoupCard> ) => void exchangeReturn( {
			params, query: respondQuery, payload: { cards }
		} ).then( report ),
		onPass: () => void pass( {
			params, payload: PassInteractionInput.make( { frameId: frame?.id } )
		} ).then( report )
	};

	return (
		<div className={ "flex w-full max-w-6xl flex-col items-center gap-3" }>
			<GameInfo
				id={ game.id }
				deadline={ game.runtime.deadline }
				spectators={ game.runtime.spectators }
				name={ "coup" }
				completed={ isCompleted }
				showChat={ nonBotPlayers.length > 1 }
				additionalInfo={
					<Fragment>
						{ game.view.coins[ me ] !== undefined && (
							<StatBlock label={ "COINS" }>{ game.view.coins[ me ] }</StatBlock>
						) }
						<StatBlock label={ "DECK" }>{ game.view.deckSize }</StatBlock>
					</Fragment>
				}
			/>

			{ isLobby && (
				<PlayerLobbyGrid players={ seats } seats={ game.config.playerCount }/>
			) }
			<GameStatusPanel
				status={ game.status }
				seated={ game.context.players.length }
				playerCount={ game.config.playerCount }
			>
				{ hasSeat && game.status === "CREATED" && (
					<AddBots addBots={ () => void addBots( { params } ) } disabled={ adding }/>
				) }
				{ hasSeat && game.status === "PLAYERS_READY" && (
					<StartGame startGame={ () => void start( { params } ) } disabled={ starting }/>
				) }
			</GameStatusPanel>

			<GameStandings
				results={ game.results }
				players={ game.players }
				playerId={ me }
			/>
			<RematchPanel
				game={ "coup" }
				gameId={ game.id }
				status={ game.status }
				rematch={ game.runtime.rematch }
				seated={ hasSeat }
				rematchAtom={ rematchAtom }
			/>

			{ !isLobby && (
				<>
					<TurnBanner
						status={ game.status }
						players={ game.players }
						currentPlayer={ game.context.currentPlayer }
						isMyTurn={ isMyTurn }
						action={ frame ? "WAITING ON THE TABLE" : undefined }
					/>

					<PendingBanner
						pending={ game.view.pending }
						players={ game.players }
						deadline={ game.runtime.interactionDeadline }
					/>

					{ !!frame && !waitingOnMe && (
						<CoupResponsePanel
							key={ frame.id }
							frame={ frame }
							view={ game.view }
							players={ game.players }
							me={ me }
							deadline={ game.runtime.interactionDeadline }
							disabled={ responding || autoPlaying }
							{ ...respond }
						/>
					) }

					<div className={ "grid w-full grid-cols-1 gap-2 md:grid-cols-2" }>
						{ seats.map( player => (
							<CoupPlayerRow
								key={ player.id }
								player={ player }
								view={ game.view }
								isMe={ player.id === me }
								isCurrentTurn={ game.context.currentPlayer === player.id && isPlaying }
								frame={ frame }
								isTargetSelected={ target === player.id }
								onTarget={ armed && player.id !== me
									? () => setTarget( player.id )
									: undefined }
							/>
						) ) }
					</div>

					{ hasSeat && (
						<CoupHandView
							hand={ game.view.hand }
							drawn={ game.view.drawn }
							lost={ game.view.lost }
						/>
					) }
				</>
			) }

			{ isPlaying && hasSeat && !isOut && (
				<ActionBar contentClassName={ "flex-col" }>
					{ !!frame && waitingOnMe && (
						<CoupResponsePanel
							key={ frame.id }
							frame={ frame }
							view={ game.view }
							players={ game.players }
							me={ me }
							deadline={ game.runtime.interactionDeadline }
							disabled={ responding || autoPlaying }
							{ ...respond }
						/>
					) }

					{ canAct && (
						<CoupActionPanel
							view={ game.view }
							players={ game.players }
							me={ me }
							aliveOthers={ aliveOthers }
							armed={ armed }
							target={ target }
							onArm={ action => {
								setArmed( action );
								setTarget( undefined );
							} }
							onPlay={ play }
							disabled={ acting }
						/>
					) }

					{ !canAct && !frame && (
						<p className={ "text-xs text-muted-foreground" }>
							{ autoPlaying ? "A bot is playing your seat." : "Waiting for your turn." }
						</p>
					) }

					<div className={ "flex flex-wrap gap-2 justify-center" }>
						<AutoPlayToggle
							autoPlaying={ autoPlaying }
							setAutoPlay={ enabled => void setAutoPlay( {
								params,
								payload: AutoPlayInput.make( { enabled } )
							} ) }
							disabled={ switching }
						/>

						{ /*
						  * The one game where a hint is worth asking for off-turn: a
						  * challenge window is a real decision, and it is the only kind
						  * of decision here a seat can be asked to make while somebody
						  * else holds the turn.
						  */ }
						<CoupHint
							game={ game }
							gameId={ gameId }
							disabled={ !canAct && !waitingOnMe }
						/>
					</div>
				</ActionBar>
			) }
		</div>
	);
}

import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WordleConfig, WordleView } from "@/games/wordle/schema";
import { WordleGrid } from "@/games/wordle/ui/board";
import {
	addBotsAtom,
	autoPlayAtom,
	forfeitAtom,
	guessAtom,
	rematchAtom
} from "@/games/wordle/ui/client";
import { DuelScoreboard, RivalBoards } from "@/games/wordle/ui/duel-view";
import { WordleHint } from "@/games/wordle/ui/hint";
import { Keyboard } from "@/games/wordle/ui/keyboard";
import { isValidWord, normalizeGuess } from "@/games/wordle/utils";
import { Button } from "@/shared/primitives/button";
import type { GameView, PlayerId } from "@/swish/schema";
import { AutoPlayInput, GameId } from "@/swish/schema";
import { ActionBar } from "@/swish/ui/action-bar";
import { GameInfo } from "@/swish/ui/game-info";
import { GameStandings } from "@/swish/ui/game-standings";
import { GameStatusPanel } from "@/swish/ui/game-status-panel";
import { PlayerLobbyGrid } from "@/swish/ui/player-lobby";
import { RematchPanel } from "@/swish/ui/rematch";
import { AddBots, AutoPlayToggle } from "@/swish/ui/seat-controls";
import { StatBlock } from "@/swish/ui/stat-block";


type Game = GameView<WordleView, WordleConfig>;

const SHAKE_DURATION_MS = 600;

/**
 * How long the flip runs before the row stops being "the row that just landed".
 *
 * Long enough to cover the last tile's staggered turn. Without this the row
 * stayed flagged for the rest of the game, and every unrelated re-render — a
 * rival's guess, a socket push, the clock — flipped it again.
 */
const REVEAL_DURATION_MS = 1200;

export type WordleGameViewProps = {
	readonly game: Game;
	readonly gameId: string;
	readonly me: PlayerId;
};

export function WordleGameView( { game, gameId, me }: WordleGameViewProps ) {
	const [ currentGuess, setCurrentGuess ] = useState( "" );
	const [ invalidGuess, setInvalidGuess ] = useState( false );
	const [ lastRevealedRow, setLastRevealedRow ] = useState<number | null>( null );

	const board = game.view.boards.find( b => b.playerId === me );

	const prevGuessCountRef = useRef( board?.guessCount ?? 0 );
	const shakeTimer = useRef<ReturnType<typeof setTimeout>>( undefined );
	const revealTimer = useRef<ReturnType<typeof setTimeout>>( undefined );

	const guess = useAtomSet( guessAtom, { mode: "promiseExit" } );
	const forfeit = useAtomSet( forfeitAtom, { mode: "promiseExit" } );
	const addBots = useAtomSet( addBotsAtom, { mode: "promiseExit" } );
	const autoPlay = useAtomSet( autoPlayAtom, { mode: "promiseExit" } );

	const guessing = useAtomValue( guessAtom ).waiting;
	const forfeiting = useAtomValue( forfeitAtom ).waiting;
	const adding = useAtomValue( addBotsAtom ).waiting;
	const switching = useAtomValue( autoPlayAtom ).waiting;
	const isPending = guessing || forfeiting || adding || switching;

	const params = useMemo( () => ( { gameId: GameId.make( gameId ) } ), [ gameId ] );

	/** Shakes the typed row and puts the word back in it, so it can be edited. */
	const rejectGuess = useCallback( ( rejected: string ) => {
		setCurrentGuess( rejected );
		setInvalidGuess( true );
		clearTimeout( shakeTimer.current );
		shakeTimer.current = setTimeout( () => setInvalidGuess( false ), SHAKE_DURATION_MS );
	}, [] );

	useEffect( () => () => {
		clearTimeout( shakeTimer.current );
		clearTimeout( revealTimer.current );
	}, [] );

	const guessCount = board?.guessCount ?? 0;
	useEffect( () => {
		if ( guessCount > prevGuessCountRef.current ) {
			setLastRevealedRow( guessCount - 1 );
			clearTimeout( revealTimer.current );
			revealTimer.current = setTimeout( () => setLastRevealedRow( null ), REVEAL_DURATION_MS );
		}

		prevGuessCountRef.current = guessCount;
	}, [ guessCount ] );

	const wordLength = game.config.wordLength;
	const canGuess = game.status === "IN_PROGRESS" && !board?.finished;

	const handleKeyPress = useCallback( ( letter: string ) => {
		setCurrentGuess( prev => prev.length < wordLength ? prev + letter : prev );
	}, [ wordLength ] );

	const handleBackspace = useCallback( () => {
		setCurrentGuess( prev => prev.slice( 0, -1 ) );
	}, [] );

	// The guess is read from state rather than from a `setCurrentGuess` updater:
	// an updater is not a place to fire a mutation, since React is free to run it
	// more than once and would send the word twice.
	const handleSubmit = useCallback( () => {
		const normalized = normalizeGuess( currentGuess );
		if ( normalized.length !== wordLength || !canGuess ) {
			return;
		}

		// Checked here against the same list the engine validates with, so an
		// unknown word shakes immediately instead of after a round trip. The
		// server still checks — this is an affordance, not a gate.
		if ( !isValidWord( normalized, wordLength ) ) {
			rejectGuess( normalized );
			return;
		}

		setCurrentGuess( "" );
		void guess( { params, payload: { guess: normalized } } ).then( exit => {
			if ( Exit.isFailure( exit ) ) {
				rejectGuess( normalized );
			}
		} );
	}, [ currentGuess, wordLength, canGuess, guess, params, rejectGuess ] );

	useEffect( () => {
		if ( !canGuess ) {
			return;
		}

		const onKeyDown = ( e: KeyboardEvent ) => {
			if ( e.metaKey || e.ctrlKey || e.altKey ) {
				return;
			}

			if ( e.key === "Enter" ) {
				handleSubmit();
			} else if ( e.key === "Backspace" ) {
				handleBackspace();
			} else if ( /^[a-zA-Z]$/.test( e.key ) ) {
				handleKeyPress( e.key.toLowerCase() );
			}
		};

		window.addEventListener( "keydown", onKeyDown );
		return () => window.removeEventListener( "keydown", onKeyDown );
	}, [ canGuess, handleSubmit, handleKeyPress, handleBackspace ] );

	// No board means no seat: a spectator. Wordle is the one game that used to
	// return nothing at all here, because every screen below was written around
	// a board that was assumed to exist — which rendered a watcher a blank page.
	// The personal half of the screen is dropped instead of the whole of it; the
	// rival boards are the game from the outside, and they were always public.
	const watching = !board;

	const isDuel = game.config.playerCount > 1;
	const isLobby = game.status === "CREATED" || game.status === "PLAYERS_READY";
	const inProgress = game.status === "IN_PROGRESS";
	const isCompleted = game.status === "COMPLETED";
	const canPlay = inProgress && !!board && !board.finished;
	const nonBotPlayers = game.context.players.filter( pid => !game.players[ pid ]?.isBot );

	const seated = game.context.players.length;
	const seatsToFill = game.config.playerCount - seated;
	const autoPlaying = HashSet.has( game.runtime.autoPlay, me );

	return (
		<div className={ "flex flex-col gap-3 items-center max-w-6xl w-full" }>
			<GameInfo
				id={ game.id }
				deadline={ game.runtime.deadline }
				spectators={ game.runtime.spectators }
				name={ "wordle" }
				completed={ isCompleted }
				additionalInfo={ board
					? (
						<Fragment>
							<StatBlock label={ "GUESSES" }>
								{ board.guessCount }/{ game.view.maxGuesses }
							</StatBlock>
							<StatBlock label={ "WORDS" }>
								{ board.solvedWords.filter( Boolean ).length }/{ game.config.wordCount }
							</StatBlock>
						</Fragment>
					)
					: undefined }
				showChat={ nonBotPlayers.length > 1 }
			/>

			{ isLobby && (
				<PlayerLobbyGrid
					players={ game.context.players.flatMap( id => game.players[ id ]
						? [ game.players[ id ] ]
						: [] ) }
					seats={ game.config.playerCount }
				/>
			) }
			<GameStatusPanel
				status={ game.status }
				seated={ seated }
				playerCount={ game.config.playerCount }
				hint={ "Share the game code; the race starts the moment every seat is filled." }
			>
				{ !watching && seatsToFill > 0 && (
					<AddBots
						addBots={ () => void addBots( { params } ) }
						disabled={ isPending }
					/>
				) }
			</GameStatusPanel>

			<GameStandings
				results={ game.results }
				players={ game.players }
				playerId={ me }
				scoreLabel={ "SCORE" }
			/>
			<RematchPanel
				game={ "wordle" }
				gameId={ game.id }
				status={ game.status }
				rematch={ game.runtime.rematch }
				seated={ game.context.players.includes( me ) }
				rematchAtom={ rematchAtom }
			/>

			{ ( isDuel || watching ) && inProgress && (
				<DuelScoreboard game={ game } me={ watching ? undefined : me }/>
			) }

			{ game.status !== "CREATED" && !!board && (
				<WordleGrid
					board={ board }
					wordLength={ wordLength }
					maxGuesses={ game.view.maxGuesses }
					currentGuess={ currentGuess }
					invalidGuess={ invalidGuess }
					lastRevealedRow={ lastRevealedRow }
					answers={ game.view.answers }
				/>
			) }

			{ inProgress && !!board && board.finished && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					<p className={ "text-status" }>YOUR BOARD IS DONE</p>
					<p className={ "text-sm text-muted-foreground" }>
						{ isDuel
							? "Waiting for the other players to finish."
							: "Waiting for the game to be scored." }
					</p>
				</div>
			) }

			{ watching && inProgress && (
				<div className={ "rounded-md bg-background p-4 text-center w-full" }>
					<p className={ "text-status" }>YOU ARE WATCHING</p>
					<p className={ "text-sm text-muted-foreground" }>
						You have no board of your own, so you get everybody else's.
					</p>
				</div>
			) }

			<RivalBoards game={ game } me={ watching ? undefined : me }/>

			{ !!board && canPlay && (
				<ActionBar className={ "py-3" } contentClassName={ "max-w-3xl flex-col" }>
					<Keyboard
						guesses={ board.guesses }
						isPending={ isPending }
						onKeyPress={ handleKeyPress }
						onBackspace={ handleBackspace }
						onSubmit={ handleSubmit }
					/>

					<div className={ "flex flex-wrap gap-2 justify-center" }>
						<AutoPlayToggle
							autoPlaying={ autoPlaying }
							setAutoPlay={ enabled => void autoPlay( {
								params,
								payload: AutoPlayInput.make( { enabled } )
							} ) }
							disabled={ isPending }
						/>

						<WordleHint gameId={ gameId } disabled={ isPending }/>

						<Button
							variant={ "neutral" }
							onClick={ () => void forfeit( { params, payload: {} } ) }
							disabled={ isPending }
						>
							GIVE UP
						</Button>
					</div>
				</ActionBar>
			) }
		</div>
	);
}

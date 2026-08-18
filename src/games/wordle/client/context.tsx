"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import type { ReactNode } from "react";

import { wordleApi } from "@/games/wordle/client/client.ts";
import { WordleConfig, WordleSeatView } from "@/games/wordle/shared/schema.ts";
import { isValidWord, normalizeGuess } from "@/games/wordle/shared/utils.ts";
import { ErrorState } from "@/shared/ui/components/error-state.tsx";
import { GameView } from "@/swish/shared/schema.ts";

import type { Board, WordleView } from "@/games/wordle/shared/schema.ts";
import type { GameId } from "@/swish/shared/schema.ts";

type WordleContextValue = {
	data: GameView<WordleSeatView, WordleConfig>;
	/** The viewing seat's own board — the only one this client can type into. */
	board: Board;
	currentGuess: string;
	/** Whether the bot policy is playing this seat's board rather than its player. */
	autoPlaying: boolean;
	isPending: boolean;
	invalidGuess: boolean;
	lastRevealedRow: number | null;
	handleKeyPress: ( letter: string ) => void;
	handleBackspace: () => void;
	handleSubmit: () => void;
	forfeit: () => void;
	addBots: () => void;
	setAutoPlay: ( enabled: boolean ) => void;
};

const WordleContext = createContext<WordleContextValue | null>( null );

const SHAKE_DURATION_MS = 600;

/**
 * How long the flip runs before the row stops being "the row that just landed".
 *
 * Long enough to cover the last tile's staggered turn. Without this the row
 * stayed flagged for the rest of the game, and every unrelated re-render — a
 * rival's guess, a socket push, the clock — flipped it again.
 */
const REVEAL_DURATION_MS = 1200;

export function useWordle() {
	const ctx = useContext( WordleContext );
	if ( !ctx ) {
		throw new Error( "useWordle must be used within a WordleProvider" );
	}
	return ctx;
}

type WordleProviderProps = {
	data: GameView<WordleView, WordleConfig>;
	gameId: GameId;
	children: ReactNode;
};

export function WordleProvider( { data, gameId, children }: WordleProviderProps ) {
	const queryClient = useQueryClient();
	const [ currentGuess, setCurrentGuess ] = useState( "" );
	const [ invalidGuess, setInvalidGuess ] = useState( false );
	const [ lastRevealedRow, setLastRevealedRow ] = useState<number | null>( null );

	const board = data.view.boards.find( b => b.playerId === data.view.playerId );

	const prevGuessCountRef = useRef( board?.guessCount ?? 0 );
	const shakeTimer = useRef<ReturnType<typeof setTimeout>>( undefined );
	const revealTimer = useRef<ReturnType<typeof setTimeout>>( undefined );

	/** Shakes the typed row and puts the word back in it, so it can be edited. */
	const rejectGuess = useCallback( ( guess: string ) => {
		setCurrentGuess( guess );
		setInvalidGuess( true );
		clearTimeout( shakeTimer.current );
		shakeTimer.current = setTimeout( () => setInvalidGuess( false ), SHAKE_DURATION_MS );
	}, [] );

	const invalidate = () => queryClient.invalidateQueries( {
		queryKey: [ "wordle", "getState", gameId ]
	} );

	const submitGuess = useMutation( {
		mutationFn: ( guess: string ) => wordleApi.guess( gameId, { guess } ),
		onSuccess: invalidate,

		// Put the word back in the box so a rejected guess can be edited rather
		// than retyped, and shake the row it was typed into.
		onError: ( _error, guess ) => rejectGuess( guess )
	} );

	const forfeit = useMutation( {
		mutationFn: () => wordleApi.forfeit( gameId ),
		onSuccess: invalidate
	} );

	const bots = useMutation( {
		mutationFn: () => wordleApi.addBots( gameId ),
		onSuccess: invalidate
	} );

	const autoPlay = useMutation( {
		mutationFn: ( enabled: boolean ) => wordleApi.setAutoPlay( gameId, { enabled } ),
		onSuccess: invalidate
	} );

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

	const wordLength = data.config.wordLength;
	const canGuess = data.status === "IN_PROGRESS" && !board?.finished;

	const handleKeyPress = useCallback( ( letter: string ) => {
		setCurrentGuess( prev => prev.length < wordLength ? prev + letter : prev );
	}, [ wordLength ] );

	const handleBackspace = useCallback( () => {
		setCurrentGuess( prev => prev.slice( 0, -1 ) );
	}, [] );

	// `useMutation`'s result is a fresh object every render, so the callback depends
	// on `mutate` alone — which is stable — rather than on the mutation itself.
	const { mutate: sendGuess } = submitGuess;

	// The guess is read from state rather than from a `setCurrentGuess` updater:
	// an updater is not a place to fire a mutation, since React is free to run it
	// more than once and would send the word twice.
	const handleSubmit = useCallback( () => {
		const guess = normalizeGuess( currentGuess );
		if ( guess.length !== wordLength || !canGuess ) {
			return;
		}

		// Checked here against the same list the engine validates with, so an
		// unknown word shakes immediately instead of after a round trip. The
		// server still checks — this is an affordance, not a gate.
		if ( !isValidWord( guess, wordLength ) ) {
			rejectGuess( guess );
			return;
		}

		setCurrentGuess( "" );
		sendGuess( guess );
	}, [ currentGuess, wordLength, canGuess, sendGuess, rejectGuess ] );

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

	// A caller holding no seat gets the table view, whose boards carry tallies but
	// no rows and no `playerId` — there is nothing here for them to play.
	if ( !data.view.playerId || !board ) {
		// A screen holding no seat — a spectator, or a stale link. These three games
		// have only a seat's screen to offer, so say so rather than rendering blank.
		return (
			<ErrorState
				title={ "You don't have a seat in this game" }
				message={ "This game is already under way, and only its players can watch it." }
				action={ { label: "BACK TO LOBBY", to: "/wordle" } }
			/>
		);
	}

	const playerData = GameView( WordleSeatView, WordleConfig )
		.make( { ...data, view: { ...data.view, playerId: data.view.playerId } } );

	return (
		<WordleContext value={ {
			data: playerData,
			board,
			currentGuess,
			autoPlaying: data.autoPlay[ data.view.playerId ] ?? false,
			isPending: submitGuess.isPending
				|| forfeit.isPending
				|| bots.isPending
				|| autoPlay.isPending,
			invalidGuess,
			lastRevealedRow,
			handleKeyPress,
			handleBackspace,
			handleSubmit,
			forfeit: () => forfeit.mutate(),
			addBots: () => bots.mutate(),
			setAutoPlay: enabled => autoPlay.mutate( enabled )
		} }>
			{ children }
		</WordleContext>
	);
}

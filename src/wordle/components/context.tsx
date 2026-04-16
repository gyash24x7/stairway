"use client";

import { useSync } from "@/shared/engine/hooks";
import { submitGuess } from "@/wordle/core/actions";
import type { WordleGame } from "@/wordle/core/types";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

type WordleContextValue = {
	game: WordleGame;
	currentGuess: string;
	isPending: boolean;
	handleKeyPress: ( letter: string ) => void;
	handleBackspace: () => void;
	handleSubmit: () => void;
};

const WordleContext = createContext<WordleContextValue | null>( null );

export function useWordle() {
	const ctx = useContext( WordleContext );
	if ( !ctx ) {
		throw new Error( "useWordle must be used within a WordleProvider" );
	}
	return ctx;
}

type WordleProviderProps = { data: WordleGame; children: ReactNode; }

export function WordleProvider( { data, children }: WordleProviderProps ) {
	const game = useSync( "wordle", data.id, data );
	const [ currentGuess, setCurrentGuess ] = useState( "" );
	const submitGuessFn = useServerFn( submitGuess );
	const { isPending, mutate } = useMutation( {
		mutationFn: submitGuessFn,
		onSettled: () => setCurrentGuess( "" )
	} );

	const wordLength = game.config.wordLength;
	const gameInProgress = game.status === "IN_PROGRESS";

	const handleSubmit = useCallback( () => {
		const guess = currentGuess.trim().toLowerCase();
		if ( !guess || guess.length !== wordLength ) {
			return;
		}

		mutate( { data: { gameId: game.id, guess } } );
	}, [ currentGuess, wordLength, game ] );

	const handleKeyPress = useCallback( ( letter: string ) => {
		setCurrentGuess( prev => prev.length < wordLength ? prev + letter : prev );
	}, [ wordLength ] );

	const handleBackspace = useCallback( () => {
		setCurrentGuess( prev => prev.slice( 0, -1 ) );
	}, [] );

	const handleKeyDown = ( e: KeyboardEvent ) => {
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

	useEffect( () => {
		if ( !gameInProgress ) {
			return;
		}

		window.addEventListener( "keydown", handleKeyDown );
		return () => window.removeEventListener( "keydown", handleKeyDown );

	}, [ gameInProgress, handleSubmit, handleKeyPress, handleBackspace ] );

	return (
		<WordleContext
			value={ { game: game, currentGuess, isPending, handleKeyPress, handleBackspace, handleSubmit } }>
			{ children }
		</WordleContext>
	);
}

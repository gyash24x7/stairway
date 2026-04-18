"use client";

import { submitGuess } from "@/wordle/core/actions";
import { dictionaries } from "@/wordle/core/dictionary";
import type { WordleGame } from "@/wordle/core/types";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState, useTransition } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

type WordleContextValue = {
	game: WordleGame;
	currentGuess: string;
	isPending: boolean;
	invalidGuess: boolean;
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
	const [ game ] = useSyncedState<WordleGame>( data, data.id, "wordle" );
	const [ currentGuess, setCurrentGuess ] = useState( "" );
	const [ isPending, startTransition ] = useTransition();
	const [ invalidGuess, setInvalidGuess ] = useState( false );

	const wordLength = game.config.wordLength;
	const gameInProgress = game.status === "IN_PROGRESS";

	const handleSubmit = () => startTransition( async () => {
		const guess = currentGuess.trim().toLowerCase();
		if ( !guess || guess.length !== wordLength ) {
			return;
		}

		const dictionary = dictionaries[ wordLength ];
		if ( !dictionary.includes( guess ) ) {
			setInvalidGuess( true );
			setTimeout( () => setInvalidGuess( false ), 1500 );
			return;
		}

		setCurrentGuess( "" );
		await submitGuess( { gameId: game.id, guess } );
	} );

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
		<WordleContext value={ { game, currentGuess, isPending, invalidGuess, handleKeyPress, handleBackspace, handleSubmit } }>
			{ children }
		</WordleContext>
	);
}

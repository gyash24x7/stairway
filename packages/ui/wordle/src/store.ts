"use client";

import { calculatePositions, dictionary, getAvailableLetters, type PositionData } from "@stairway/words";
import type { Game } from "@wordle/api";
import { produce } from "immer";
import { createContext, useContext } from "react";
import { createStore, StoreApi, useStore } from "zustand";

export type GameStore = {
	gameData: Game;
	currentGuess: string[];
	backspaceCurrentGuess: () => void;
	updateCurrentGuess: ( guess: string ) => void;
	resetCurrentGuess: () => void;
	updateGameData: ( data: Game ) => void;
};

export const createGameStore = ( gameData: Game ) => createStore<GameStore>( ( set ) => ( {
	gameData,
	currentGuess: [],
	backspaceCurrentGuess: () => {
		set(
			produce<GameStore>( state => {
				state.currentGuess = state.currentGuess.slice( 0, state.currentGuess.length - 1 );
			} )
		);
	},
	updateCurrentGuess: ( letter: string ) => {
		set(
			produce<GameStore>( state => {
				if ( state.currentGuess.length < state.gameData.wordLength ) {
					state.currentGuess.push( letter );
				}
			} )
		);
	},
	resetCurrentGuess: () => {
		set(
			produce<GameStore>( state => {
				state.currentGuess = [];
			} )
		);
	},
	updateGameData: ( data ) => {
		set(
			produce<GameStore>( state => {
				state.gameData = data;
			} )
		);
	}
} ) );

export const GameStoreContext = createContext<StoreApi<GameStore> | undefined>( undefined );

export const useGameStore = <T>( selector: ( store: GameStore ) => T ) => {
	const gameStoreContext = useContext( GameStoreContext );
	if ( !gameStoreContext ) {
		throw new Error( "useGameStore to be used from inside the provider!" );
	}

	return useStore( gameStoreContext, selector );
};

// Game State Hooks
export const useGameWords = () => useGameStore( state => state.gameData.words );
export const useGameGuesses = () => useGameStore( state => state.gameData.guesses );
export const useIsGameCompleted = () => useGameStore( state => {
	const areAllWordsCompleted = state.gameData.words.length === state.gameData.completedWords.length;
	const areAllGuessesCompleted = state.gameData.guesses.length ===
		state.gameData.words.length + state.gameData.wordLength;
	return areAllGuessesCompleted || areAllWordsCompleted;
} );

export const useAvailableLetters = () => useGameStore( state => getAvailableLetters( state.gameData.guesses ) );

export const useGuessBlockMap = () => useGameStore( ( { gameData, currentGuess } ) => {
	const map: Record<string, PositionData[][]> = {};
	gameData.words.forEach( word => {
		const completedIndex = gameData.guesses.indexOf( word );
		map[ word ] = new Array( gameData.wordLength + gameData.wordCount ).fill( 0 ).map(
			( _, i ) => i < gameData.guesses.length
				? calculatePositions( word, gameData.guesses[ i ], completedIndex !== -1 && i > completedIndex )
				: new Array( gameData.wordLength ).fill( 0 ).map( ( _, index ) => {
					if ( completedIndex > -1 ) {
						return { letter: "", state: "empty", index };
					}

					if ( i === gameData.guesses.length ) {
						return { letter: currentGuess[ index ], state: "empty", index };
					}

					return { letter: "", state: "empty", index };
				} )
		);
	} );
	return map;
} );

export const useGameId = () => useGameStore( state => state.gameData.id );
export const useCurrentGuess = () => useGameStore( state => state.currentGuess );
export const useBackspaceCurrentGuess = () => useGameStore( state => state.backspaceCurrentGuess );
export const useResetCurrentGuess = () => useGameStore( state => state.resetCurrentGuess );
export const useUpdateCurrentGuess = () => useGameStore( state => state.updateCurrentGuess );
export const useIsValidWord = () => useGameStore( state => dictionary.includes( state.currentGuess.join( "" ) ) );
export const useUpdateGameData = () => useGameStore( state => state.updateGameData );
export const useIsValidGuessLength = () => useGameStore(
	state => state.currentGuess.length === state.gameData.wordLength
);

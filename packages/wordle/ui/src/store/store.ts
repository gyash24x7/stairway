import type { Game } from "@wordle/data";
import { produce } from "immer";
import { create } from "zustand";


export type GameStore = {
	gameData: Game;
	currentGuess: string[];
	backspaceCurrentGuess: () => void;
	updateCurrentGuess: ( guess: string ) => void;
	resetCurrentGuess: () => void;
	updateGameData: ( data: Game ) => void;
};

const defaultGameData: Game = {
	id: "",
	playerId: "",
	words: [],
	guesses: [],
	wordCount: 1,
	wordLength: 5,
	completedWords: []
};


export const useGameStore = create<GameStore>( ( set ) => {
	return {
		gameData: defaultGameData,
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
	};
} );
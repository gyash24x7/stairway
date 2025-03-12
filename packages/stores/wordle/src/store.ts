import type { Wordle } from "@stairway/types/wordle";
import { produce } from "immer";
import { create } from "zustand";

export type GameStore = {
	game: Wordle.Game;
	currentGuess: string[];
	backspaceCurrentGuess: () => void;
	updateCurrentGuess: ( guess: string ) => void;
	resetCurrentGuess: () => void;
	updateGameData: ( data: Wordle.Game ) => void;
};

export const useGameStore = create<GameStore>( ( set ) => ( {
	game: {
		id: "",
		playerId: "",
		wordLength: 0,
		wordCount: 0,
		words: [],
		guesses: [],
		completedWords: []
	},
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
				if ( state.currentGuess.length < state.game.wordLength ) {
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
				state.game = data;
			} )
		);
	}
} ) );
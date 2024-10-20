import { observable } from "@legendapp/state";
import type { Game } from "@stairway/api/wordle";

export type GameStore = {
	game: Game;
	currentGuess: string[];
	backspaceCurrentGuess: () => void;
	updateCurrentGuess: ( guess: string ) => void;
	resetCurrentGuess: () => void;
	updateGameData: ( data: Game ) => void;
};

export const wordle$ = observable<GameStore>( {
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
		wordle$.currentGuess.set( wordle$.currentGuess.slice( 0, wordle$.currentGuess.get().length - 1 ) );
	},
	updateCurrentGuess: ( letter: string ) => {
		if ( wordle$.currentGuess.get().length < wordle$.game.wordLength.get() ) {
			wordle$.currentGuess.push( letter );
		}
	},
	resetCurrentGuess: () => {
		wordle$.currentGuess.set( [] );
	},
	updateGameData: ( data ) => {
		wordle$.game.set( data );
	}
} );
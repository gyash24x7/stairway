import type { Wordle } from "@/wordle/types";
import { Store } from "@tanstack/react-store";
import { produce } from "immer";

export const store = new Store<Wordle.Store>( {
	currentGuess: [],
	game: {
		id: "",
		playerId: "",
		wordLength: 0,
		wordCount: 0,
		words: [],
		guesses: [],
		completedWords: []
	}
} );

export function backspaceCurrentGuess() {
	store.setState( state => produce( state, draft => {
		draft.currentGuess.pop();
	} ) );
}

export function updateCurrentGuess( letter: string ) {
	store.setState( state => produce( state, draft => {
		draft.currentGuess.push( letter );
	} ) );
}

export function resetCurrentGuess() {
	store.setState( state => produce( state, draft => {
		draft.currentGuess = [];
	} ) );
}

export function updateGameData( game: Wordle.Game ) {
	store.setState( state => produce( state, draft => {
		draft.game = game;
	} ) );
}
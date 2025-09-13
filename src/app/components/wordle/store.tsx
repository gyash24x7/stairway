"use client";

import type { PlayerGameInfo } from "@/core/wordle/schema";
import { Store } from "@tanstack/react-store";
import { produce } from "immer";
import { Fragment, type ReactNode, useEffect } from "react";

type WordleStore = {
	currentGuess: string[];
	game: PlayerGameInfo;
}

export const store = new Store<WordleStore>( {
	currentGuess: [],
	game: {
		id: "",
		playerId: "",
		wordLength: 0,
		wordCount: 0,
		guesses: [],
		completedWords: [],
		completed: false,
		guessBlocks: []
	}
} );

export function backspaceCurrentGuess() {
	store.setState( state => produce( state, draft => {
		draft.currentGuess.pop();
		for ( let i = 0; i < draft.game.guessBlocks.length; i++ ) {
			draft.game.guessBlocks[ i ][ draft.game.guesses.length ] = new Array( draft.game.wordLength ).fill( 0 )
				.map( ( _, index ) => ( { letter: draft.currentGuess[ index ] ?? "", state: "empty", index } ) );
		}
	} ) );
}

export function updateCurrentGuess( letter: string ) {
	store.setState( state => produce( state, draft => {
		draft.currentGuess.push( letter );
		for ( let i = 0; i < draft.game.guessBlocks.length; i++ ) {
			draft.game.guessBlocks[ i ][ draft.game.guesses.length ] = new Array( draft.game.wordLength ).fill( 0 )
				.map( ( _, index ) => ( { letter: draft.currentGuess[ index ] ?? "", state: "empty", index } ) );
		}
	} ) );
}

export function resetCurrentGuess() {
	store.setState( state => produce( state, draft => {
		draft.currentGuess = [];
		for ( let i = 0; i < draft.game.guessBlocks.length; i++ ) {
			draft.game.guessBlocks[ i ][ draft.game.guesses.length ] = new Array( draft.game.wordLength ).fill( 0 )
				.map( ( _, index ) => ( { letter: draft.currentGuess[ index ] ?? "", state: "empty", index } ) );
		}
	} ) );
}

export function updateGameData( game: PlayerGameInfo ) {
	store.setState( state => produce( state, draft => {
		draft.game = game;
	} ) );
}

export function StoreLoader( props: { children: ReactNode; data: PlayerGameInfo } ) {
	useEffect( () => {
		updateGameData( props.data );
	}, [ props.data ] );

	return <Fragment>{ props.children }</Fragment>;
}
"use client";

import type { GameData } from "@/core/wordle/schema";
import { Store } from "@tanstack/react-store";
import { produce } from "immer";
import { Fragment, type ReactNode, useEffect } from "react";

type WordleStore = {
	currentGuess: string[];
	game: GameData;
}

export const store = new Store<WordleStore>( {
	currentGuess: [],
	game: {
		id: "",
		playerId: "",
		wordLength: 0,
		wordCount: 0,
		words: [],
		guesses: [],
		completedWords: [],
		completed: false
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

export function updateGameData( game: GameData ) {
	store.setState( state => produce( state, draft => {
		draft.game = game;
	} ) );
}

export function StoreLoader( props: { children: ReactNode; data: GameData } ) {
	useEffect( () => {
		updateGameData( props.data );
	}, [ props.data ] );

	return <Fragment>{ props.children }</Fragment>;
}
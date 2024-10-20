"use server";

import "server-only";
import type { CreateGameInput, MakeGuessInput } from "./inputs.ts";
import { caller } from "./router.ts";

export async function createGame( input: CreateGameInput ) {
	return caller.createGame( input );
}

export async function getGameData( gameId: string ) {
	return caller.getGame( { gameId } );
}

export async function makeGuess( input: MakeGuessInput ) {
	return caller.makeGuess( input );
}
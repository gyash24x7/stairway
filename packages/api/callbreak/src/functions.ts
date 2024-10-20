"use server";

import "server-only";
import type { CreateGameInput, DeclareDealWinsInput, PlayCardInput } from "./inputs.ts";
import { caller } from "./router.ts";

export async function createGame( input: CreateGameInput ) {
	return caller.createGame( input );
}

export async function joinGame( code: string ) {
	return caller.joinGame( { code } );
}

export async function addBots( gameId: string ) {
	return caller.addBots( { gameId } );
}

export async function getGameData( gameId: string ) {
	return caller.getGameData( { gameId } );
}

export async function declareDealWins( input: DeclareDealWinsInput ) {
	return caller.declareDealWins( input );
}

export async function playCard( input: PlayCardInput ) {
	return caller.playCard( input );
}

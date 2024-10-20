"use server";

import "server-only";
import { caller } from "./router.ts";

export async function createGame( playerCount?: number ) {
	return caller.createGame( { playerCount } );
}

export async function joinGame( code: string ) {
	return caller.joinGame( { code } );
}

export async function getGameData( gameId: string ) {
	return caller.getGameData( { gameId } );
}

export async function addBots( gameId: string ) {
	return caller.addBots( { gameId } );
}

export async function createTeams( gameId: string, data: Record<string, string[]> ) {
	return caller.createTeams( { gameId, data } );
}

export async function startGame( gameId: string ) {
	return caller.startGame( { gameId } );
}

export async function askCard( gameId: string, from: string, card: string ) {
	return caller.askCard( { gameId, from, card } );
}

export async function callSet( gameId: string, data: Record<string, string> ) {
	return caller.callSet( { gameId, data } );
}

export async function transferTurn( gameId: string, transferTo: string ) {
	return caller.transferTurn( { gameId, transferTo } );
}

export async function executeBotMove( gameId: string ) {
	return caller.executeBotMove( { gameId } );
}

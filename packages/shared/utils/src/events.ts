import { EventEmitter } from "node:events";

export type GenericEvent = {
	gameId: string;
	playerId?: string;
	event: string;
	data: any;
}

const ee = new EventEmitter();

export function emitGameEvent( game: "literature" | "callbreak", event: GenericEvent ) {
	ee.emit( game, event );
}

export function subscribeToGameEvents( game: "literature" | "callbreak", handler: ( event: GenericEvent ) => void ) {
	ee.on( game, handler );
}
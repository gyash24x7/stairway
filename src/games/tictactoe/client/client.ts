import { client } from "@/client.ts";
import { gameFn, gameInputFn, inputFn } from "@/swish/client/api.ts";

/** Tic Tac Toe's endpoints, as calls a component can make. */
export const tictactoeApi = {
	createGame: inputFn( client.tictactoe.createGame ),
	join: inputFn( client.tictactoe.join ),
	getView: gameFn( client.tictactoe.getView ),
	addBots: gameFn( client.tictactoe.addBots ),
	start: gameFn( client.tictactoe.start ),
	undo: gameFn( client.tictactoe.undo ),
	redo: gameFn( client.tictactoe.redo ),
	place: gameInputFn( client.tictactoe.place ),
	setAutoPlay: gameInputFn( client.tictactoe.setAutoPlay ),
	rematch: gameInputFn( client.tictactoe.rematch )
};

import { client } from "@/client.ts";
import { gameFn, gameInputFn, inputFn } from "@/swish/client/api.ts";

/** Wordle's endpoints, as calls a component can make. */
export const wordleApi = {
	createGame: inputFn( client.wordle.createGame ),
	join: inputFn( client.wordle.join ),
	getView: gameFn( client.wordle.getView ),
	addBots: gameFn( client.wordle.addBots ),
	guess: gameInputFn( client.wordle.guess ),
	forfeit: gameInputFn( client.wordle.forfeit ),
	setAutoPlay: gameInputFn( client.wordle.setAutoPlay ),
	rematch: gameInputFn( client.wordle.rematch )
};

import { client } from "@/client.ts";
import { gameFn, gameInputFn, inputFn } from "@/swish/client/api.ts";

/**
 * Fish's endpoints, as calls a component can make. `joinTeam` and `nameTeam` are
 * lobby-only — the engine refuses either once the game has started.
 */
export const fishApi = {
	createGame: inputFn( client.fish.createGame ),
	join: inputFn( client.fish.join ),
	getView: gameFn( client.fish.getView ),
	addBots: gameFn( client.fish.addBots ),
	start: gameFn( client.fish.start ),
	undo: gameFn( client.fish.undo ),
	redo: gameFn( client.fish.redo ),
	joinTeam: gameInputFn( client.fish.joinTeam ),
	nameTeam: gameInputFn( client.fish.nameTeam ),
	leaveTeam: gameFn( client.fish.leaveTeam ),
	askCard: gameInputFn( client.fish.askCard ),
	claimBook: gameInputFn( client.fish.claimBook ),
	transferTurn: gameInputFn( client.fish.transferTurn ),
	setAutoPlay: gameInputFn( client.fish.setAutoPlay ),
	rematch: gameInputFn( client.fish.rematch )
};

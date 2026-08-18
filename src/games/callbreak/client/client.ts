import { client } from "@/client.ts";
import { gameFn, gameInputFn, inputFn } from "@/swish/client/api.ts";

/**
 * Callbreak's endpoints, as calls a component can make. `getView` answers with
 * the game as the caller may see it: a seated player gets their own hand; anyone
 * else — the account driving a television, say — gets the table's view, which is
 * the same envelope with `hand` empty and no `playerId`.
 */
export const callbreakApi = {
	createGame: inputFn( client.callbreak.createGame ),
	join: inputFn( client.callbreak.join ),
	getView: gameFn( client.callbreak.getView ),
	addBots: gameFn( client.callbreak.addBots ),
	start: gameFn( client.callbreak.start ),
	undo: gameFn( client.callbreak.undo ),
	redo: gameFn( client.callbreak.redo ),
	declareWins: gameInputFn( client.callbreak.declareWins ),
	playCard: gameInputFn( client.callbreak.playCard ),
	setAutoPlay: gameInputFn( client.callbreak.setAutoPlay )
};

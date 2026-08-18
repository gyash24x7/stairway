import { client } from "@/client.ts";
import { gameFn, gameInputFn, inputFn } from "@/swish/client/api.ts";

/**
 * Splendor's endpoints, as calls a component can make. `pass` is legal only when
 * the rules leave the seat nothing else to do, and `claimNoble` settles an open
 * noble-visit frame with the noble the buyer chose.
 *
 * Splendor hides only the order of the three decks, so a seat and a spectator
 * get almost the same envelope from `getView` — what differs is `view.playerId`.
 */
export const splendorApi = {
	createGame: inputFn( client.splendor.createGame ),
	join: inputFn( client.splendor.join ),
	getView: gameFn( client.splendor.getView ),
	addBots: gameFn( client.splendor.addBots ),
	start: gameFn( client.splendor.start ),
	undo: gameFn( client.splendor.undo ),
	redo: gameFn( client.splendor.redo ),
	pickTokens: gameInputFn( client.splendor.pickTokens ),
	reserveCard: gameInputFn( client.splendor.reserveCard ),
	purchaseCard: gameInputFn( client.splendor.purchaseCard ),
	pass: gameInputFn( client.splendor.pass ),
	claimNoble: gameInputFn( client.splendor.claimNoble ),
	setAutoPlay: gameInputFn( client.splendor.setAutoPlay )
};

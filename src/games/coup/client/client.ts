import { client } from "@/client.ts";
import { gameFn, gameInputFn, inputFn } from "@/swish/client/api.ts";

/**
 * Coup's endpoints, as calls a component can make.
 *
 * `takeAction` is the only one a seat plays on its own turn. The other four
 * answer a reaction window the engine opened — a challenge, a block, the choice
 * of which card to give up, and an Ambassador's choice of what to keep — and are
 * refused unless that window is open and this seat is one of the responders.
 *
 * A seat and a spectator get the same envelope from `getView` with different
 * things filled in: `view.influence` holds your own cards and is empty for the
 * table, and every other seat is an `influenceCount` either way.
 */
export const coupApi = {
	createGame: inputFn( client.coup.createGame ),
	join: inputFn( client.coup.join ),
	getView: gameFn( client.coup.getView ),
	addBots: gameFn( client.coup.addBots ),
	start: gameFn( client.coup.start ),
	undo: gameFn( client.coup.undo ),
	redo: gameFn( client.coup.redo ),
	takeAction: gameInputFn( client.coup.takeAction ),
	challenge: gameInputFn( client.coup.challenge ),
	block: gameInputFn( client.coup.block ),
	surrenderInfluence: gameInputFn( client.coup.surrenderInfluence ),
	exchangeCards: gameInputFn( client.coup.exchangeCards ),
	setAutoPlay: gameInputFn( client.coup.setAutoPlay ),
	rematch: gameInputFn( client.coup.rematch )
};

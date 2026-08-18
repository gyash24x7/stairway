import { client, run } from "@/client.ts";
import { gameFn, gameInputFn, inputFn } from "@/swish/client/api.ts";

import type { KingdominoCreateInput } from "@/games/kingdomino/shared/schema.ts";

/**
 * The create payload is a union — a 7x7 kingdom is a duel's, and the schema says
 * so by pairing each seat count with the sizes it allows. The generated client
 * takes the union of *request objects* rather than an object over the union, so
 * the branch is spelled out here to narrow `payload` into one member. That is
 * also why this one endpoint is written out rather than wrapped by `inputFn`,
 * which would infer the payload as whichever member of the union comes first.
 *
 * @param payload - The seat count, and the board size it allows.
 * @returns A reference to the game created.
 */
const createGame = ( payload: KingdominoCreateInput ) =>
	run( payload.playerCount === 2
		? client.kingdomino.createGame( { payload } )
		: client.kingdomino.createGame( { payload } ) );

/**
 * Kingdomino's endpoints, as calls a component can make. Kingdomino hides only
 * the undrawn deck, so a seat and a spectator get almost the same envelope from
 * `getView` — what differs is `view.playerId`.
 */
export const kingdominoApi = {
	createGame,
	join: inputFn( client.kingdomino.join ),
	getView: gameFn( client.kingdomino.getView ),
	addBots: gameFn( client.kingdomino.addBots ),
	start: gameFn( client.kingdomino.start ),
	undo: gameFn( client.kingdomino.undo ),
	redo: gameFn( client.kingdomino.redo ),
	selectDomino: gameInputFn( client.kingdomino.selectDomino ),
	placeDomino: gameInputFn( client.kingdomino.placeDomino ),
	discardDomino: gameInputFn( client.kingdomino.discardDomino ),
	setAutoPlay: gameInputFn( client.kingdomino.setAutoPlay )
};

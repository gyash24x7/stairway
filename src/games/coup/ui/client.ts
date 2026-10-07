import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Atom from "effect/reactivity/Atom";
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi";

import { CoupApi } from "@/games/coup/contract";
import { GameId } from "@/swish/schema";
import { withReconnect } from "@/swish/ui/live-view";


export class ApiClient extends AtomHttpApi.Service<ApiClient>()(
	"coup/ApiClient",
	{ api: CoupApi, httpClient: FetchHttpClient.layer }
) {}

/**
 * The game as this player is allowed to see it, kept live.
 *
 * The endpoint sends the current view on connect and again after every commit,
 * so this is the table's only read: there is no fetch to pair with the
 * subscription and no polling behind it. Every claim, challenge and block comes
 * back to whoever made it the same way it reaches everyone else, as the engine's
 * next view — and the engine redacts per audience, so a hand only ever reaches
 * its own seat.
 *
 * A family rather than one atom, because the view is addressed by game id and
 * each table holds its own connection. The atom is torn down when the last
 * reader unmounts, which closes that connection.
 *
 * The `revision` check matters more here than in a game of plain turns. A Coup
 * table spends most of its time inside an interaction window, where every answer
 * moves `pending` and the window's clock without committing anything — `version`
 * does not move, and a client deduping on it would sit on a stale window while
 * the table talked past it.
 */
export const coupLiveViewAtom = Atom.family( ( gameId: string ) =>
	ApiClient.runtime.atom( withReconnect(
		Stream.unwrap( Effect.gen( function* () {
			const client = yield* ApiClient;
			return yield* client.coup.subscribe( {
				params: { gameId: GameId.make( gameId ) }
			} );
		} ) )
	).pipe(
		Stream.changesWith( ( a, b ) => a.runtime.revision === b.runtime.revision )
	) ) );

export const createGameAtom = ApiClient.mutation( "coup", "createGame" );
export const joinGameAtom = ApiClient.mutation( "coup", "joinGame" );
export const spectateGameAtom = ApiClient.mutation( "coup", "spectate" );
export const startGameAtom = ApiClient.mutation( "coup", "startGame" );
export const addBotsAtom = ApiClient.mutation( "coup", "addBots" );
export const autoPlayAtom = ApiClient.mutation( "coup", "autoPlay" );
export const rematchAtom = ApiClient.mutation( "coup", "rematch" );

/**
 * What the game would play for this seat, asked on demand.
 *
 * A `mutation` although the endpoint is a plain read: `mutation` is what gives
 * the fire-on-click, read-the-result shape every other control here uses, and a
 * hint is asked for rather than watched. It cannot come through the live view —
 * nothing about the table changes when somebody asks, so `revision` does not
 * move and the subscription has no news to push.
 */
export const hintAtom = ApiClient.mutation( "coup", "hint" );

// --- Turn actions ----------------------------------------------------------

export const incomeAtom = ApiClient.mutation( "coup", "income" );
export const foreignAidAtom = ApiClient.mutation( "coup", "foreignAid" );
export const coupAtom = ApiClient.mutation( "coup", "coup" );
export const taxAtom = ApiClient.mutation( "coup", "tax" );
export const assassinateAtom = ApiClient.mutation( "coup", "assassinate" );
export const stealAtom = ApiClient.mutation( "coup", "steal" );
export const exchangeAtom = ApiClient.mutation( "coup", "exchange" );

// --- Responses -------------------------------------------------------------

export const challengeAtom = ApiClient.mutation( "coup", "challenge" );
export const blockForeignAidAtom = ApiClient.mutation( "coup", "blockForeignAid" );
export const blockAssassinationAtom = ApiClient.mutation( "coup", "blockAssassination" );
export const blockStealAtom = ApiClient.mutation( "coup", "blockSteal" );
export const revealAtom = ApiClient.mutation( "coup", "reveal" );
export const exchangeReturnAtom = ApiClient.mutation( "coup", "exchangeReturn" );
export const passAtom = ApiClient.mutation( "coup", "pass" );

import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Atom from "effect/reactivity/Atom";
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi";

import { CallbreakApi } from "@/games/callbreak/contract";
import { GameId } from "@/swish/schema";
import { withReconnect } from "@/swish/ui/live-view";


export class ApiClient extends AtomHttpApi.Service<ApiClient>()(
	"callbreak/ApiClient",
	{ api: CallbreakApi, httpClient: FetchHttpClient.layer }
) {}

/**
 * The game as this player is allowed to see it, kept live.
 *
 * The endpoint sends the current view on connect and again after every commit,
 * so this is the table's only read: there is no fetch to pair with the
 * subscription and no polling behind it. Each card a player plays comes back to
 * them the same way it reaches everyone else, as the engine's next view — and
 * the engine redacts per audience, so a hand only ever reaches its own seat.
 *
 * A family rather than one atom, because the view is addressed by game id and
 * each table holds its own connection. The atom is torn down when the last
 * reader unmounts, which closes that connection.
 *
 * The `revision` check is what keeps the heartbeat invisible. The endpoint
 * re-sends the current view on a timer so the connection is never silent, and
 * `withReconnect` needs those repeats to tell a live game from a dead socket —
 * but a repeat is not news, so it is dropped here rather than re-rendered.
 */
export const callbreakLiveViewAtom = Atom.family( ( gameId: string ) =>
	ApiClient.runtime.atom( withReconnect(
		Stream.unwrap( Effect.gen( function* () {
			const client = yield* ApiClient;
			return yield* client.callbreak.subscribe( {
				params: { gameId: GameId.make( gameId ) }
			} );
		} ) )
	).pipe(
		Stream.changesWith( ( a, b ) => a.runtime.revision === b.runtime.revision )
	) ) );

export const createGameAtom = ApiClient.mutation( "callbreak", "createGame" );
export const joinGameAtom = ApiClient.mutation( "callbreak", "joinGame" );
export const spectateGameAtom = ApiClient.mutation( "callbreak", "spectate" );
export const startGameAtom = ApiClient.mutation( "callbreak", "startGame" );
export const addBotsAtom = ApiClient.mutation( "callbreak", "addBots" );
export const autoPlayAtom = ApiClient.mutation( "callbreak", "autoPlay" );
export const rematchAtom = ApiClient.mutation( "callbreak", "rematch" );

/**
 * What the game would play for this seat, asked on demand.
 *
 * A `mutation` although the endpoint is a plain read: `mutation` is what gives
 * the fire-on-click, read-the-result shape every other control here uses, and a
 * hint is asked for rather than watched. It cannot come through the live view —
 * nothing about the table changes when somebody asks, so `revision` does not
 * move and the subscription has no news to push.
 */
export const hintAtom = ApiClient.mutation( "callbreak", "hint" );
export const undoAtom = ApiClient.mutation( "callbreak", "undo" );
export const redoAtom = ApiClient.mutation( "callbreak", "redo" );
export const declareWinsAtom = ApiClient.mutation( "callbreak", "declareWins" );
export const playCardAtom = ApiClient.mutation( "callbreak", "playCard" );

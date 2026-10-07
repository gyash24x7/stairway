import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Atom from "effect/reactivity/Atom";
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi";

import { FishApi } from "@/games/fish/contract";
import { GameId, GameRef } from "@/swish/schema";
import { withReconnect } from "@/swish/ui/live-view";


export class ApiClient extends AtomHttpApi.Service<ApiClient>()(
	"fish/ApiClient",
	{ api: FishApi, httpClient: FetchHttpClient.layer }
) {}

/**
 * The game as this player is allowed to see it, kept live.
 *
 * The endpoint sends the current view on connect and again after every commit,
 * so this is the table's only read: there is no fetch to pair with the
 * subscription and no polling behind it. Every ask and every claim comes back to
 * the asker the same way it reaches everyone else, as the engine's next view —
 * and the engine redacts per audience, so a hand only ever reaches its own seat.
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
export const fishLiveViewAtom = Atom.family( ( gameId: string ) =>
	ApiClient.runtime.atom( withReconnect(
		Stream.unwrap( Effect.gen( function* () {
			const client = yield* ApiClient;
			return yield* client.fish.subscribe( {
				params: GameRef.make( { gameId: GameId.make( gameId ) } )
			} );
		} ) )
	).pipe(
		Stream.changesWith( ( a, b ) => a.runtime.revision === b.runtime.revision )
	) ) );

export const createGameAtom = ApiClient.mutation( "fish", "createGame" );
export const joinGameAtom = ApiClient.mutation( "fish", "joinGame" );
export const spectateGameAtom = ApiClient.mutation( "fish", "spectate" );
export const startGameAtom = ApiClient.mutation( "fish", "startGame" );
export const addBotsAtom = ApiClient.mutation( "fish", "addBots" );
export const autoPlayAtom = ApiClient.mutation( "fish", "autoPlay" );
export const rematchAtom = ApiClient.mutation( "fish", "rematch" );

/**
 * What the game would play for this seat, asked on demand.
 *
 * A `mutation` although the endpoint is a plain read: `mutation` is what gives
 * the fire-on-click, read-the-result shape every other control here uses, and a
 * hint is asked for rather than watched. It cannot come through the live view —
 * nothing about the table changes when somebody asks, so `revision` does not
 * move and the subscription has no news to push.
 */
export const hintAtom = ApiClient.mutation( "fish", "hint" );
export const undoAtom = ApiClient.mutation( "fish", "undo" );
export const redoAtom = ApiClient.mutation( "fish", "redo" );
export const joinTeamAtom = ApiClient.mutation( "fish", "joinTeam" );
export const leaveTeamAtom = ApiClient.mutation( "fish", "leaveTeam" );
export const nameTeamAtom = ApiClient.mutation( "fish", "nameTeam" );
export const askCardAtom = ApiClient.mutation( "fish", "askCard" );
export const claimBookAtom = ApiClient.mutation( "fish", "claimBook" );
export const transferTurnAtom = ApiClient.mutation( "fish", "transferTurn" );

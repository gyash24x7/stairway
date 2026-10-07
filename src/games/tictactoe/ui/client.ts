import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Atom from "effect/reactivity/Atom";
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi";

import { TicTacToeApi } from "@/games/tictactoe/contract";
import { GameId } from "@/swish/schema";
import { withReconnect } from "@/swish/ui/live-view";


export class ApiClient extends AtomHttpApi.Service<ApiClient>()(
	"tictactoe/ApiClient",
	{ api: TicTacToeApi, httpClient: FetchHttpClient.layer }
) {}

/**
 * The game as this player is allowed to see it, kept live.
 *
 * The endpoint sends the current view on connect and again after every commit,
 * so this is the table's only read: there is no fetch to pair with the
 * subscription and no polling behind it. Each move a player makes comes back to
 * them the same way it reaches everyone else, as the engine's next view.
 *
 * A family rather than one atom, because the view is addressed by game id and
 * each table holds its own connection. The atom is torn down when the last
 * reader unmounts, which closes that connection.
 *
 * The `revision` check is what keeps the heartbeat invisible. The endpoint
 * re-sends the current view on a timer so the connection is never silent, and
 * `withReconnect` needs those repeats to tell a live game from a dead socket —
 * but a repeat is not news, so it is dropped here rather than re-rendered.
 *
 * It is `revision` rather than `version` because a seat handed to the bot policy
 * commits nothing: `version` stays where it is while the turn clock and the
 * auto-play roster both move, and dropping that would leave the timer on screen
 * counting down to an instant that has already been replaced.
 */
export const tictactoeLiveViewAtom = Atom.family( ( gameId: string ) =>
	ApiClient.runtime.atom( withReconnect(
		Stream.unwrap( Effect.gen( function* () {
			const client = yield* ApiClient;
			return yield* client.tictactoe.subscribe( {
				params: { gameId: GameId.make( gameId ) }
			} );
		} ) )
	).pipe(
		Stream.changesWith( ( a, b ) => a.runtime.revision === b.runtime.revision )
	) ) );

export const createGameAtom = ApiClient.mutation( "tictactoe", "createGame" );
export const joinGameAtom = ApiClient.mutation( "tictactoe", "joinGame" );
export const spectateGameAtom = ApiClient.mutation( "tictactoe", "spectate" );
export const startGameAtom = ApiClient.mutation( "tictactoe", "startGame" );
export const placeAtom = ApiClient.mutation( "tictactoe", "place" );
export const undoAtom = ApiClient.mutation( "tictactoe", "undo" );
export const redoAtom = ApiClient.mutation( "tictactoe", "redo" );
export const addBotsAtom = ApiClient.mutation( "tictactoe", "addBots" );
export const autoPlayAtom = ApiClient.mutation( "tictactoe", "autoPlay" );
export const rematchAtom = ApiClient.mutation( "tictactoe", "rematch" );

/**
 * What the game would play for this seat, asked on demand.
 *
 * A `mutation` although the endpoint is a plain read: `mutation` is what gives
 * the fire-on-click, read-the-result shape every other control here uses, and a
 * hint is asked for rather than watched. It cannot come through the live view —
 * nothing about the table changes when somebody asks, so `revision` does not
 * move and the subscription has no news to push.
 */
export const hintAtom = ApiClient.mutation( "tictactoe", "hint" );

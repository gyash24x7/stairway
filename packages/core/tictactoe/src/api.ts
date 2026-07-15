// @s2h/tictactoe/api — the Effect v4 HttpApi surface for Tic-Tac-Toe.
//
// The shared engine lifecycle + the `place` move + undo/redo, assembled by
// `defineEngineApi`. Definition only (handlers live in the serving app);
// pure/browser-safe.

import { GameApiGroup, MoveApiEndpoint } from "@s2h/swish/api";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import { PlaceInput, TicTacToeConfig, TicTacToeSnapshot } from "./schema";

export class TicTacToeApi extends HttpApi.make( "tic-tac-toe" ).add(
	GameApiGroup( "tic-tac-toe", {
		config: TicTacToeConfig,
		snapshot: TicTacToeSnapshot,
		moves: [ MoveApiEndpoint( "place", PlaceInput ) ]
	} )
) {}

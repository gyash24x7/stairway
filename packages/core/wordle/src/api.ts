// @s2h/wordle/api — the Effect v4 HttpApi surface for the Wordle game.
//
// One `HttpApiGroup` (the shared engine lifecycle + the `guess` move + undo/redo)
// assembled by `defineEngineApi`, each endpoint carrying a `:gameId` path param.
// Definition only — the handlers live in the serving app. Pure/browser-safe.

import { GameApiGroup, MoveApiEndpoint } from "@s2h/swish/api";
import { GuessInput, WordleConfig, WordleSnapshot } from "./schema";

export const WordleApiGroup = GameApiGroup( "wordle", {
	config: WordleConfig,
	snapshot: WordleSnapshot,
	moves: [ MoveApiEndpoint( "guess", GuessInput ) ]
} );

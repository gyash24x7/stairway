// @s2h/callbreak/api — the Effect v4 HttpApi surface for Callbreak.
//
// The shared engine lifecycle + the `declareWins`/`playCard` moves + undo/redo,
// assembled by `defineEngineApi`. Definition only (handlers live in the serving
// app); pure/browser-safe.

import { GameApiGroup, MoveApiEndpoint } from "@s2h/swish/api";
import { CallbreakConfig, CallbreakSnapshot, DeclareWinsInput, PlayCardInput } from "./schema";

export class CallbreakApiGroup extends GameApiGroup( "callbreak", {
	config: CallbreakConfig,
	snapshot: CallbreakSnapshot,
	moves: [
		MoveApiEndpoint( "declareWins", DeclareWinsInput ),
		MoveApiEndpoint( "playCard", PlayCardInput )
	]
} ) {}

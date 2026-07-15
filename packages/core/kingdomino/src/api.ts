// @s2h/kingdomino/api — the Effect v4 HttpApi surface for Kingdomino.
//
// The shared engine lifecycle + the three moves + undo/redo, assembled by
// `defineEngineApi`. Definition only (handlers live in the serving app);
// pure/browser-safe.

import { GameApiGroup, MoveApiEndpoint } from "@s2h/swish/api";
import {
	DiscardDominoInput,
	KingdominoConfig,
	KingdominoSnapshot,
	PlaceDominoInput,
	SelectDominoInput
} from "./schema";

export const KingdominoApiGroup = GameApiGroup( "kingdomino", {
	config: KingdominoConfig,
	snapshot: KingdominoSnapshot,
	moves: [
		MoveApiEndpoint( "selectDomino", SelectDominoInput ),
		MoveApiEndpoint( "placeDomino", PlaceDominoInput ),
		MoveApiEndpoint( "discardDomino", DiscardDominoInput )
	]
} );

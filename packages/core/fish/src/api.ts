// @s2h/fish/api — the Effect v4 HttpApi surface for Fish (Literature).
//
// The shared engine lifecycle + the four moves + undo/redo, assembled by
// `defineEngineApi`. Definition only (handlers live in the serving app);
// pure/browser-safe.

import { GameApiGroup, MoveApiEndpoint } from "@s2h/swish/api";
import {
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishSnapshot,
	TransferTurnInput
} from "./schema";
import { GAME_NAME } from "./utils";

export const FishApiGroup = GameApiGroup( GAME_NAME, {
	config: FishConfig,
	snapshot: FishSnapshot,
	moves: [
		MoveApiEndpoint( "createTeams", CreateTeamsInput ),
		MoveApiEndpoint( "askCard", AskCardInput ),
		MoveApiEndpoint( "claimBook", ClaimBookInput ),
		MoveApiEndpoint( "transferTurn", TransferTurnInput )
	]
} );

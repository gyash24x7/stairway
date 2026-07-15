// @s2h/fish/api — the Effect v4 HttpApi surface for Fish (Literature).
//
// The shared engine lifecycle + the four moves + undo/redo, assembled by
// `defineEngineApi`. Definition only (handlers live in the serving app);
// pure/browser-safe.

import { GameApiGroup, MoveApiEndpoint } from "@s2h/swish/api";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import {
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishSnapshot,
	TransferTurnInput
} from "./schema";
import { GAME_NAME } from "./utils";

export class FishApi extends HttpApi.make( GAME_NAME ).add(
	GameApiGroup( GAME_NAME, {
		config: FishConfig,
		snapshot: FishSnapshot,
		moves: [
			MoveApiEndpoint( "createTeams", CreateTeamsInput ),
			MoveApiEndpoint( "askCard", AskCardInput ),
			MoveApiEndpoint( "claimBook", ClaimBookInput ),
			MoveApiEndpoint( "transferTurn", TransferTurnInput )
		]
	} )
) {}

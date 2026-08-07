import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	StartApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api.ts";
import {
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishSnapshot,
	TransferTurnInput
} from "@/games/fish/shared/schema.ts";

export const FishApiGroup = HttpApiGroup.make( "fish" )
	.add(
		CreateGameApiEndpoint( FishConfig ),
		GetStateApiEndpoint( FishSnapshot ),
		JoinApiEndpoint(),
		StartApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "createTeams", CreateTeamsInput ),
		MoveApiEndpoint( "askCard", AskCardInput ),
		MoveApiEndpoint( "claimBook", ClaimBookInput ),
		MoveApiEndpoint( "transferTurn", TransferTurnInput )
	)
	.prefix( "/fish" )
	.middleware( AuthMiddleware );

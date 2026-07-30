import { AuthMiddleware } from "@/auth/shared/middleware";
import {
	AddBotsApiEndpoint,
	CreateGameApiEndpoint,
	GetStateApiEndpoint,
	JoinApiEndpoint,
	MoveApiEndpoint
} from "@/shared/swish/api";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import {
	AskCardInput,
	ClaimBookInput,
	CreateTeamsInput,
	FishConfig,
	FishSnapshot,
	TransferTurnInput
} from "./schema";

export const FishApiGroup = HttpApiGroup.make( "fish" )
	.add(
		CreateGameApiEndpoint( FishConfig ),
		GetStateApiEndpoint( FishSnapshot ),
		JoinApiEndpoint(),
		AddBotsApiEndpoint(),
		MoveApiEndpoint( "createTeams", CreateTeamsInput ),
		MoveApiEndpoint( "askCard", AskCardInput ),
		MoveApiEndpoint( "claimBook", ClaimBookInput ),
		MoveApiEndpoint( "transferTurn", TransferTurnInput )
	)
	.prefix( "/fish" )
	.middleware( AuthMiddleware );
